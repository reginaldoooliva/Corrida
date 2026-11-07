// Jack Daniels / Jimmy Gilbert VDOT model (Daniels' Running Formula).

// Oxygen cost (ml/kg/min) of running at `velocity` metres per minute.
function oxygenCost(velocity: number): number {
  return -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
}

// Fraction of VO2max sustainable for a race lasting `minutes`.
function fractionOfMax(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

export function calculateVdot(distanceKm: number, timeSec: number): number {
  const minutes = timeSec / 60;
  const velocity = (distanceKm * 1000) / minutes;
  return oxygenCost(velocity) / fractionOfMax(minutes);
}

// World-record 5km/10km/marathon performances sit around VDOT 85; anything
// beyond this ceiling is treated as a typo, not a real result.
const MAX_PLAUSIBLE_VDOT = 90;

export function isPlausibleResult(distanceKm: number, timeSec: number): boolean {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(timeSec)) return false;
  if (distanceKm <= 0 || timeSec <= 0) return false;
  const vdot = calculateVdot(distanceKm, timeSec);
  return vdot > 0 && vdot <= MAX_PLAUSIBLE_VDOT;
}
