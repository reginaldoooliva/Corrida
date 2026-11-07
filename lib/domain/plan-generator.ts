import { RaceType } from "@prisma/client";

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
