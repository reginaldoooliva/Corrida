import {
  Decision,
  Prisma,
  SessionType,
  type Session,
  type WeeklyAdjustment,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type { SessionDraft } from "./plan-generator";
import { paceForVdot } from "./vdot";

export interface WeekWithLogs {
  sessions: Array<{
    plannedPaceSecPerKm: number;
    workoutLog: { actualPaceSecPerKm: number; rpe: number } | null;
  }>;
}

export interface Signals {
  paceDeviation: boolean;
  rpe: boolean;
  missed: boolean;
}

// Spec ADJ-01. Called only for an ended week, so every unlogged session counts as missed.
// Pace and RPE use logged sessions only; with none logged they have no data and stay false.
export function computeSignals(week: WeekWithLogs): Signals {
  const logged = week.sessions.flatMap((s) =>
    s.workoutLog ? [{ planned: s.plannedPaceSecPerKm, ...s.workoutLog }] : [],
  );
  const missedCount = week.sessions.length - logged.length;

  const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
  const plannedSum = sum(logged.map((l) => l.planned));
  const actualSum = sum(logged.map((l) => l.actualPaceSecPerKm));
  const rpeSum = sum(logged.map((l) => l.rpe));

  // Averages share the same count, so compare sums in integer terms (no float rounding at the edge).
  return {
    paceDeviation: logged.length > 0 && actualSum * 100 >= plannedSum * 105,
    rpe: logged.length > 0 && rpeSum >= 8 * logged.length,
    missed: missedCount * 4 >= week.sessions.length,
  };
}

// Spec ADJ-02..04: 0 signals -> progress, exactly 1 -> maintain, 2 or 3 -> reduce.
export function decide(signals: Signals): Decision {
  const triggered = [signals.paceDeviation, signals.rpe, signals.missed].filter(Boolean).length;
  if (triggered === 0) return Decision.PROGRESS;
  if (triggered === 1) return Decision.MAINTAIN;
  return Decision.REDUCE;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const REDUCE_FACTOR = 0.8;
// One intensity level down (spec ADJ-02): Tempo runs at Easy pace, Interval at Tempo pace.
const STEP_DOWN: Partial<Record<SessionType, SessionType>> = {
  [SessionType.TEMPO]: SessionType.EASY,
  [SessionType.INTERVAL]: SessionType.TEMPO,
};

// SPEC_DEVIATION: design.md lists `applyDecision(decision, nextWeekDraft)`; this takes a third
// `{ currentWeek, vdot }` argument.
// Reason: `maintain` must clone the current week (ADJ-03) and `reduce` must re-derive the stepped-down
// pace (ADJ-02), and neither is recoverable from the next week's draft alone.
export function applyDecision(
  decision: Decision,
  nextWeekDraft: SessionDraft[],
  context: { currentWeek: SessionDraft[]; vdot: number },
): SessionDraft[] {
  if (decision === Decision.PROGRESS) return nextWeekDraft;

  if (decision === Decision.MAINTAIN) {
    // Same sessions on the same weekdays, one week later; periodization does not advance. Spec DEL-13:
    // matched by weekday, not by position - after a deleted session the two weeks differ in length,
    // and each next-week session keeps its own date. One with no session on its weekday in the
    // current week stays as generated.
    const day = (d: Date) => Math.floor(d.getTime() / DAY_MS);
    const current = new Map(context.currentWeek.map((s) => [day(s.date) + 7, s]));
    return nextWeekDraft.map((n) => {
      const c = current.get(day(n.date));
      return c ? { ...c, date: n.date } : n;
    });
  }

  return nextWeekDraft.map((s) => {
    const type = STEP_DOWN[s.type] ?? s.type;
    return {
      ...s,
      type,
      plannedPaceSecPerKm:
        type === s.type ? s.plannedPaceSecPerKm : paceForVdot(context.vdot, type).secPerKm,
      plannedDistanceKm: Math.round(s.plannedDistanceKm * REDUCE_FACTOR * 100) / 100,
      plannedDurationMin: Math.round(s.plannedDurationMin * REDUCE_FACTOR),
    };
  });
}

const toDraft = (s: Session): SessionDraft => ({
  date: s.date,
  type: s.type,
  plannedPaceSecPerKm: s.plannedPaceSecPerKm,
  plannedDistanceKm: s.plannedDistanceKm ?? 0,
  plannedDurationMin: s.plannedDurationMin ?? 0,
});

// Spec ADJ-01/DASH-04: a week is due for reassessment once it has ended and was not reassessed yet.
// SPEC_DEVIATION: the spec says "hoje ≥ data de fim"; `endDate` is the week's last training day, so
// this waits until the day after it (today > endDate).
// Reason: on its last day the week's final session (often the Longão) can still be run and logged;
// reassessing that morning would judge the week without it and settle it for good (ADJ-06).
export function isWeekDue(week: { endDate: Date; reassessedAt: Date | null }, today: Date): boolean {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return !week.reassessedAt && day(week.endDate) < day(today);
}

// Spec ADJ-05/ADJ-06: reassess an ended week at most once. `reassessedAt` is the primary guard; the
// unique constraint on WeeklyAdjustment.weekId backstops a concurrent duplicate (e.g. two tabs).
// The caller passes a week that has already ended.
export async function reassessIfDue(weekId: string): Promise<WeeklyAdjustment | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const week = await tx.week.findUniqueOrThrow({
        where: { id: weekId },
        include: {
          plan: true,
          sessions: { include: { workoutLog: true }, orderBy: { date: "asc" } },
        },
      });
      if (week.reassessedAt) return null;

      const signals = computeSignals(week);
      const decision = decide(signals);
      // Inserted first so a duplicate is rejected before any session changes.
      const adjustment = await tx.weeklyAdjustment.create({
        data: {
          weekId,
          paceDeviationTriggered: signals.paceDeviation,
          rpeTriggered: signals.rpe,
          missedTriggered: signals.missed,
          decision,
          adjustmentPct: decision === Decision.REDUCE ? -20 : 0,
        },
      });

      const nextWeek = await tx.week.findFirst({
        where: { planId: week.planId, weekNumber: week.weekNumber + 1 },
        include: { sessions: { orderBy: { date: "asc" } } },
      });
      if (nextWeek && decision !== Decision.PROGRESS) {
        const drafts = applyDecision(decision, nextWeek.sessions.map(toDraft), {
          currentWeek: week.sessions.map(toDraft),
          vdot: week.plan.currentVdot,
        });
        // Updated in place: a next-week session may already carry a (future-dated) log.
        for (const [i, session] of nextWeek.sessions.entries()) {
          await tx.session.update({ where: { id: session.id }, data: drafts[i] });
        }
      }

      await tx.week.update({ where: { id: weekId }, data: { reassessedAt: new Date() } });
      return adjustment;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return null;
    throw error;
  }
}
