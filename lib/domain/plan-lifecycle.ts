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

const startOfDay = (date: Date) => new Date(utcDayNumber(date) * DAY_MS);
// Plans the user keeps (AD-005): the one followed and the paused ones. Archived plans are history.
const KEPT_STATUSES: PlanStatus[] = [PlanStatus.ACTIVE, PlanStatus.PAUSED];

// Spec LIFE-01 / PLANS-10: archive once today has passed the race date, whether the plan is followed
// or paused. Race day itself is not archived yet.
export async function archiveIfPast(planId: string, today: Date): Promise<void> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  if (!KEPT_STATUSES.includes(plan.status)) return;
  if (utcDayNumber(plan.raceDate) >= utcDayNumber(today)) return;
  await prisma.plan.update({ where: { id: planId }, data: { status: PlanStatus.ARCHIVED } });
}

// Spec PLANS-10: every active or paused plan of the user whose race date is before today.
export async function archivePastPlans(userId: string, today: Date): Promise<void> {
  await prisma.plan.updateMany({
    where: { userId, status: { in: KEPT_STATUSES }, raceDate: { lt: startOfDay(today) } },
    data: { status: PlanStatus.ARCHIVED },
  });
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

export const PLAN_LIMIT = 3;
export const PLAN_LIMIT_ERROR = "Você já tem 3 planos. Exclua um para criar outro.";

// Spec PLANS-03: a fourth active-or-paused plan is refused.
export class PlanLimitError extends Error {
  constructor() {
    super(PLAN_LIMIT_ERROR);
    this.name = "PlanLimitError";
  }
}

// Spec PLANS-13: two requests racing to make different plans active. The partial unique index on
// Plan(userId) WHERE status = 'ACTIVE' rejects the second (P2002); it gets this error.
export class PlanConflictError extends Error {
  constructor() {
    super("Seus planos mudaram em outro pedido. Tente de novo.");
    this.name = "PlanConflictError";
  }
}

const isUniqueViolation = (error: unknown) => (error as { code?: unknown })?.code === "P2002";

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

// Spec PLANS-01/03/04 (AD-005, replacing LIFE-06): up to 3 active-or-paused plans; archived plans
// never count. createPlan pauses the plan followed until now.
export async function createNewPlan(input: CreatePlanInput): ReturnType<typeof createPlan> {
  const kept = await prisma.plan.count({
    where: { userId: input.userId, status: { in: KEPT_STATUSES } },
  });
  if (kept >= PLAN_LIMIT) throw new PlanLimitError();
  try {
    return await createPlan(input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new PlanConflictError();
    throw error;
  }
}

export class PlanNotFoundError extends Error {
  constructor() {
    super("Plano não encontrado.");
    this.name = "PlanNotFoundError";
  }
}

// Spec PLANS-06/09/10/13/14: the user's paused plan becomes the followed one and the plan followed
// until now is paused. Its weeks that ended while it sat paused are settled without an adjustment
// (reassessedAt only, no WeeklyAdjustment), so returning to it never cuts the load for sessions that
// were never meant to be run. A plan whose race has passed is archived instead.
export async function followPlan(
  userId: string,
  planId: string,
  today: Date,
): Promise<"active" | "archived"> {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, userId, status: { in: KEPT_STATUSES } },
  });
  if (!plan) throw new PlanNotFoundError();
  if (utcDayNumber(plan.raceDate) < utcDayNumber(today)) {
    await prisma.plan.update({ where: { id: planId }, data: { status: PlanStatus.ARCHIVED } });
    return "archived";
  }
  if (plan.status === PlanStatus.ACTIVE) return "active";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.plan.updateMany({
        where: { userId, status: PlanStatus.ACTIVE },
        data: { status: PlanStatus.PAUSED },
      });
      await tx.plan.update({ where: { id: planId }, data: { status: PlanStatus.ACTIVE } });
      // Same "ended" rule as isWeekDue: the week's last day is before today.
      await tx.week.updateMany({
        where: { planId, reassessedAt: null, endDate: { lt: startOfDay(today) } },
        data: { reassessedAt: new Date() },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new PlanConflictError();
    throw error;
  }
  return "active";
}

export interface PlanSummary {
  id: string;
  raceType: RaceType;
  raceDate: Date;
  weeks: number;
  status: PlanStatus;
}

// Spec PLANS-05/10: the plans screen - every active or paused plan with its race, race date and week
// count, the followed one first, then by creation. Plans whose race has passed are archived first.
export async function listPlans(userId: string, today: Date): Promise<PlanSummary[]> {
  await archivePastPlans(userId, today);
  const plans = await prisma.plan.findMany({
    where: { userId, status: { in: KEPT_STATUSES } },
    orderBy: { createdAt: "asc" },
    include: { weeks: { select: { id: true } } },
  });
  const rank = (status: PlanStatus) => (status === PlanStatus.ACTIVE ? 0 : 1);
  return plans
    .map((p) => ({ id: p.id, raceType: p.raceType, raceDate: p.raceDate, weeks: p.weeks.length, status: p.status }))
    .sort((a, b) => rank(a.status) - rank(b.status));
}

// Spec DEL-02/04/14: delete one of the user's plans, whatever its status, with every row it owns,
// children first, in one transaction. No other plan changes status: when the followed plan goes,
// none is promoted (the dashboard shows its empty state).
export async function deletePlan(userId: string, planId: string): Promise<void> {
  const plan = await prisma.plan.findFirst({ where: { id: planId, userId } });
  if (!plan) throw new PlanNotFoundError();
  await prisma.$transaction(async (tx) => {
    const weeks = await tx.week.findMany({ where: { planId }, include: { sessions: true } });
    const weekIds = weeks.map((w) => w.id);
    const sessionIds = weeks.flatMap((w) => w.sessions.map((s) => s.id));
    await tx.workoutLog.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await tx.weeklyAdjustment.deleteMany({ where: { weekId: { in: weekIds } } });
    await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
    await tx.week.deleteMany({ where: { id: { in: weekIds } } });
    await tx.vdotHistory.deleteMany({ where: { planId } });
    await tx.raceResult.deleteMany({ where: { planId } });
    await tx.plan.delete({ where: { id: planId } });
  }, { timeout: 20000 });
}

export const LAST_SESSION_ERROR = "A semana precisa de pelo menos um treino.";

export class SessionNotFoundError extends Error {
  constructor() {
    super("Treino não encontrado.");
    this.name = "SessionNotFoundError";
  }
}

// Spec DEL-08/09/10/14: remove a planned session of the user's followed plan, with its WorkoutLog.
// The weekly reassessment counts only the sessions a week has (computeSignals), so a deleted one is
// never missed. A week keeps at least one session, or it could not be reassessed at all.
export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { week: { include: { plan: true, sessions: { select: { id: true } } } } },
  });
  const plan = session?.week.plan;
  if (!session || plan?.userId !== userId || plan.status !== PlanStatus.ACTIVE) {
    throw new SessionNotFoundError();
  }
  if (session.week.sessions.length <= 1) throw new Error(LAST_SESSION_ERROR);
  await prisma.$transaction(async (tx) => {
    await tx.workoutLog.deleteMany({ where: { sessionId } });
    await tx.session.deleteMany({ where: { id: { in: [sessionId] } } });
  });
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
