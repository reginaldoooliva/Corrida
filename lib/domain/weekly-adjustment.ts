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
