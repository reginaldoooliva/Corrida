// Spec LOG-01 (AD-007): the actual pace is not typed - it is the run's duration over its distance,
// in whole seconds per km. Pure, so the log form can show it while the runner types, and the Server
// Action stores the same value. Null until both are positive numbers.
export function paceFromRun(distanceKm: number, durationMin: number): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMin)) return null;
  if (distanceKm <= 0 || durationMin <= 0) return null;
  return Math.round((durationMin * 60) / distanceKm);
}
