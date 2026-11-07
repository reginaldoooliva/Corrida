import { Phase, RaceType } from "@prisma/client";

/** Day of week, 0 = Sunday .. 6 = Saturday (matches `Date#getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_MS = 24 * 60 * 60 * 1000;

// Recommended minimum plan length per race type (spec PLAN-02).
const MINIMUM_WEEKS: Record<RaceType, number> = {
  [RaceType.FIVE_K]: 8,
  [RaceType.TEN_K]: 10,
  [RaceType.HALF]: 12,
  [RaceType.MARATHON]: 16,
};

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

export function computePlanWeeks(
  raceType: RaceType,
  raceDate: Date,
  today: Date,
): { weeks: number; belowMinimum: boolean } {
  const minimum = MINIMUM_WEEKS[raceType];
  if (minimum === undefined) {
    throw new Error(`Unsupported race type: ${raceType}`);
  }
  const weeks = Math.floor((utcDayNumber(raceDate) - utcDayNumber(today)) / 7);
  return { weeks, belowMinimum: weeks < minimum };
}

export function validateDaysPerWeek(days: Weekday[]): boolean {
  return days.length >= 3 && days.length <= 6;
}

export interface PhaseAssignment {
  /** 1-based position of the week within the plan. */
  weekNumber: number;
  phase: Phase;
}

// Spec PLAN-05: taper = ceil(10% of N) clamped to [1,3]; of the remaining weeks,
// base 40% / build 35% / peak 25%, with the rounding remainder added to base.
export function splitPhases(totalWeeks: number): PhaseAssignment[] {
  const taper = Math.min(totalWeeks, 3, Math.max(1, Math.ceil(totalWeeks * 0.1)));
  const remaining = totalWeeks - taper;
  const build = Math.floor(remaining * 0.35);
  const peak = Math.floor(remaining * 0.25);
  const base = remaining - build - peak;

  const phases: Phase[] = [
    ...Array<Phase>(base).fill(Phase.BASE),
    ...Array<Phase>(build).fill(Phase.BUILD),
    ...Array<Phase>(peak).fill(Phase.PEAK),
    ...Array<Phase>(taper).fill(Phase.TAPER),
  ];
  return phases.map((phase, i) => ({ weekNumber: i + 1, phase }));
}
