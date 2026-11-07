import { RaceType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computePlanWeeks, validateDaysPerWeek } from "./plan-generator";

const DAY_MS = 24 * 60 * 60 * 1000;
const TODAY = new Date("2026-11-07T15:30:00Z");
const daysFromToday = (days: number) => new Date(TODAY.getTime() + days * DAY_MS);

const MINIMUM_WEEKS: Record<RaceType, number> = {
  [RaceType.FIVE_K]: 8,
  [RaceType.TEN_K]: 10,
  [RaceType.HALF]: 12,
  [RaceType.MARATHON]: 16,
};
const ALL_RACE_TYPES = Object.keys(MINIMUM_WEEKS) as RaceType[];

describe("plan-generator", () => {
  describe("computePlanWeeks", () => {
    it("computePlanWeeks returns raceDate minus today in weeks", () => {
      for (const raceType of ALL_RACE_TYPES) {
        expect(computePlanWeeks(raceType, daysFromToday(70), TODAY).weeks).toBe(10);
        expect(computePlanWeeks(raceType, daysFromToday(126), TODAY).weeks).toBe(18);
      }
    });

    it("computePlanWeeks counts only whole weeks", () => {
      expect(computePlanWeeks(RaceType.TEN_K, daysFromToday(76), TODAY).weeks).toBe(10);
      expect(computePlanWeeks(RaceType.TEN_K, daysFromToday(69), TODAY).weeks).toBe(9);
    });

    it("computePlanWeeks flags belowMinimum when weeks are under the race type's minimum", () => {
      for (const raceType of ALL_RACE_TYPES) {
        const min = MINIMUM_WEEKS[raceType];
        const result = computePlanWeeks(raceType, daysFromToday((min - 1) * 7), TODAY);
        expect(result).toEqual({ weeks: min - 1, belowMinimum: true });
      }
    });

    it("computePlanWeeks does not flag belowMinimum at or above the race type's minimum", () => {
      for (const raceType of ALL_RACE_TYPES) {
        const min = MINIMUM_WEEKS[raceType];
        expect(computePlanWeeks(raceType, daysFromToday(min * 7), TODAY)).toEqual({
          weeks: min,
          belowMinimum: false,
        });
        expect(
          computePlanWeeks(raceType, daysFromToday((min + 4) * 7), TODAY).belowMinimum,
        ).toBe(false);
      }
    });

    it("computePlanWeeks supports exactly the four race types and rejects others", () => {
      expect(ALL_RACE_TYPES.sort()).toEqual(Object.values(RaceType).sort());
      for (const raceType of ALL_RACE_TYPES) {
        expect(() => computePlanWeeks(raceType, daysFromToday(140), TODAY)).not.toThrow();
      }
      expect(() =>
        computePlanWeeks("ULTRA" as RaceType, daysFromToday(140), TODAY),
      ).toThrow();
    });
  });

  describe("validateDaysPerWeek", () => {
    it("validateDaysPerWeek accepts 3 to 6 training days", () => {
      expect(validateDaysPerWeek([1, 3, 5])).toBe(true);
      expect(validateDaysPerWeek([1, 2, 4, 6])).toBe(true);
      expect(validateDaysPerWeek([0, 1, 3, 5, 6])).toBe(true);
      expect(validateDaysPerWeek([0, 1, 2, 3, 4, 5])).toBe(true);
    });

    it("validateDaysPerWeek rejects fewer than 3 days", () => {
      expect(validateDaysPerWeek([])).toBe(false);
      expect(validateDaysPerWeek([2])).toBe(false);
      expect(validateDaysPerWeek([2, 4])).toBe(false);
    });

    it("validateDaysPerWeek rejects more than 6 days", () => {
      expect(validateDaysPerWeek([0, 1, 2, 3, 4, 5, 6])).toBe(false);
    });
  });
});
