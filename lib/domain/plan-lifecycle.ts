import { PlanStatus, RaceType, VdotSource, type VdotHistory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  DAYS_PER_WEEK_ERROR,
  computePlanWeeks,
  createPlan,
  generateSessions,
  splitPhases,
  validateDaysPerWeek,
  type CreatePlanInput,
  type Weekday,
} from "./plan-generator";
import { calculateVdot, isPlausibleResult } from "./vdot";
import { reassessIfDue } from "./weekly-adjustment";

const RACE_DISTANCE_KM: Record<RaceType, number> = {
  [RaceType.FIVE_K]: 5,
  [RaceType.TEN_K]: 10,
  [RaceType.HALF]: 21.0975,
  [RaceType.MARATHON]: 42.195,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

// Spec LIFE-01: archive once today has passed the race date. Race day itself is still active.
export async function archiveIfPast(planId: string, today: Date): Promise<void> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  if (plan.status !== PlanStatus.ACTIVE) return;
  if (utcDayNumber(plan.raceDate) >= utcDayNumber(today)) return;
  await prisma.plan.update({ where: { id: planId }, data: { status: PlanStatus.ARCHIVED } });
}

// The plausibility guard createPlan and recordVdotRetest apply, for a plan's own race distance.
// recordRaceResult does not run it itself (T20); the race-result prompt (T36) checks first.
export function isPlausibleRaceTime(raceType: RaceType, finishTimeSec: number): boolean {
  return isPlausibleResult(RACE_DISTANCE_KM[raceType], finishTimeSec);
}

// Spec LIFE-03: the finish time becomes a RaceResult and a race-sourced VdotHistory entry.
export async function recordRaceResult(
  planId: string,
  finishTimeSec: number,
): Promise<VdotHistory> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });
    const vdot = calculateVdot(RACE_DISTANCE_KM[plan.raceType], finishTimeSec);
    await tx.raceResult.create({
      data: { planId, finishTimeSec, date: plan.raceDate, vdotComputed: vdot },
    });
    return tx.vdotHistory.create({
      data: { planId, date: plan.raceDate, vdot, source: VdotSource.RACE },
    });
  });
}

// Spec LIFE-04/LIFE-05: a new plan starts from the previous plan's race result if one was recorded,
// otherwise from its last currentVdot.
// SPEC_DEVIATION: design.md types the return as `Promise<number>`; this returns `number | null`.
// Reason: with no previous plan there is nothing to carry over (tasks.md T21), and the caller falls
// through to the normal VDOT-establishment flow.
export async function initialVdotForNewPlan(previousPlanId?: string): Promise<number | null> {
  if (!previousPlanId) return null;
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: previousPlanId },
    include: { raceResult: true },
  });
  return plan.raceResult?.vdotComputed ?? plan.currentVdot;
}

export class ActivePlanExistsError extends Error {
  constructor() {
    super("Você já tem um plano ativo. Ele precisa terminar antes de começar outro.");
    this.name = "ActivePlanExistsError";
  }
}

// Spec LIFE-06: at most one active plan per user. The partial unique index on Plan(userId)
// WHERE status = 'ACTIVE' is the database-level backstop for a concurrent attempt.
// Spec LIFE-04/05: the VDOT a new plan defaults to - the latest archived plan's carry-over (T21) -
// and the source it is recorded under if the user keeps it: RACE when it comes from that plan's
// race result, RECALC when it is the plan's last currentVdot. Null when no plan was archived yet.
export async function carryOverVdot(userId: string): Promise<{ vdot: number; source: VdotSource } | null> {
  const previous = await prisma.plan.findFirst({
    where: { userId, status: PlanStatus.ARCHIVED },
    orderBy: { createdAt: "desc" },
    include: { raceResult: true },
  });
  if (!previous) return null;
  const vdot = await initialVdotForNewPlan(previous.id);
  if (vdot === null) return null;
  return { vdot, source: previous.raceResult ? VdotSource.RACE : VdotSource.RECALC };
}

// Spec LIFE-05: the carried-over VDOT is editable before confirming. A value the user changed
// (beyond the form's one-decimal rounding) is recorded as MANUAL; an unchanged one keeps its source.
export async function createPlanFromCarryOver(
  input: Omit<CreatePlanInput, "vdotSource" | "result" | "vdot"> & { vdot: number },
): ReturnType<typeof createPlan> {
  const carried = await carryOverVdot(input.userId);
  const kept = carried !== null && Math.abs(carried.vdot - input.vdot) < 0.05;
  return createNewPlan({ ...input, vdotSource: kept ? carried.source : VdotSource.MANUAL });
}

export async function createNewPlan(input: CreatePlanInput): ReturnType<typeof createPlan> {
  const active = await prisma.plan.findFirst({
    where: { userId: input.userId, status: PlanStatus.ACTIVE },
  });
  if (active) throw new ActivePlanExistsError();
  try {
    return await createPlan(input);
  } catch (error) {
    // Two submits racing past the check above: the partial unique index rejects the second
    // (P2002). It means the same thing as the check, so the user gets the same message (T42).
    if ((error as { code?: unknown })?.code === "P2002") throw new ActivePlanExistsError();
    throw error;
  }
}

export const RACE_DATE_ERROR = "A data da prova precisa ser depois da semana de treino atual.";

// Spec EDIT-01..03: rebuild the plan from the week containing `today` onwards with the plan's
// currentVdot. Weeks before it are not touched. WorkoutLogs are never deleted: a logged session in
// a rebuilt week is kept and stands in for the regenerated session on its date.
// SPEC_DEVIATION: design.md's signature has no `today` argument.
// Reason: "the current week" depends on the date; passing it keeps this testable, like archiveIfPast.
export async function recalculateFromCurrentWeek(
  planId: string,
  changes: { raceDate?: Date; days?: Weekday[] },
  today: Date,
): Promise<void> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId }, include: { weeks: true } });
  const raceDate = changes.raceDate ?? plan.raceDate;
  const days = changes.days ?? (plan.daysPerWeek as Weekday[]);

  if (!validateDaysPerWeek(days)) throw new Error(DAYS_PER_WEEK_ERROR);
  // Weeks are 7-day blocks counted from the plan start, exactly as createPlan lays them out.
  const startDay = utcDayNumber(plan.startDate);
  const currentWeek = Math.max(1, Math.floor((utcDayNumber(today) - startDay) / 7) + 1);
  const { weeks: totalWeeks } = computePlanWeeks(plan.raceType, raceDate, plan.startDate);
  if (totalWeeks < currentWeek) throw new Error(RACE_DATE_ERROR);

  // reassessIfDue pairs an ended week's sessions with the next week's by position. Settle the
  // ended week before the current one now, so it is never later paired with a rebuilt week whose
  // day count differs. Its WeeklyAdjustment is kept; its effect on the current week is replaced by
  // the regeneration below.
  const previous = plan.weeks.find((w) => w.weekNumber === currentWeek - 1);
  if (previous && !previous.reassessedAt) await reassessIfDue(previous.id);

  await prisma.$transaction(async (tx) => {
    const weeks = await tx.week.findMany({
      where: { planId },
      include: { sessions: { include: { workoutLog: true } } },
    });
    const rebuilt = weeks.filter((w) => w.weekNumber >= currentWeek);
    const keptWeeks = rebuilt.filter((w) => w.sessions.some((s) => s.workoutLog));

    await tx.session.deleteMany({
      where: {
        id: { in: rebuilt.flatMap((w) => w.sessions.filter((s) => !s.workoutLog).map((s) => s.id)) },
      },
    });
    await tx.week.deleteMany({
      where: { id: { in: rebuilt.filter((w) => !keptWeeks.includes(w)).map((w) => w.id) } },
    });

    for (const assignment of splitPhases(totalWeeks).slice(currentWeek - 1)) {
      const startDate = new Date((startDay + (assignment.weekNumber - 1) * 7) * DAY_MS);
      const drafts = generateSessions({ ...assignment, startDate }, days, plan.currentVdot);
      const kept = keptWeeks.find((w) => w.weekNumber === assignment.weekNumber);
      if (!kept) {
        await tx.week.create({
          data: {
            planId,
            weekNumber: assignment.weekNumber,
            phase: assignment.phase,
            startDate,
            endDate: new Date(startDate.getTime() + 6 * DAY_MS),
            sessions: { create: drafts },
          },
        });
        continue;
      }
      const loggedDays = new Set(
        kept.sessions.filter((s) => s.workoutLog).map((s) => utcDayNumber(s.date)),
      );
      await tx.week.update({ where: { id: kept.id }, data: { phase: assignment.phase } });
      await tx.session.createMany({
        data: drafts
          .filter((d) => !loggedDays.has(utcDayNumber(d.date)))
          .map((d) => ({ ...d, weekId: kept.id })),
      });
    }

    await tx.plan.update({ where: { id: planId }, data: { raceDate, daysPerWeek: days } });
    // SPEC_DEVIATION: raised from Prisma's 5000ms default interactive-transaction timeout, as in
    // createPlan. Reason: rebuilding ~10 weeks one round trip at a time against the live pooled
    // Supabase connection took 5.1s+ (P2028 "Transaction already closed"), found by T39's e2e.
  }, { timeout: 20000 });
}
