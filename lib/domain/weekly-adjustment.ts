import { Decision, SessionType } from "@prisma/client";

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
    // Same sessions on the same weekdays, one week later; periodization does not advance.
    return context.currentWeek.map((s) => ({ ...s, date: new Date(s.date.getTime() + 7 * DAY_MS) }));
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
