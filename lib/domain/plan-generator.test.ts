import { Phase, RaceType, SessionType, VdotSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database. Writes made through the transaction client are staged and
// only land in `db` when the transaction callback resolves; writes made through the global client
// land in `db` immediately (so they would survive a rollback, as on a real database).
type Row = Record<string, unknown>;
type Store = { plans: Row[]; vdotHistory: Row[]; weeks: Row[] };

const { db, failWeekCreateOnCall, modelsWritingTo } = vi.hoisted(() => {
  const db: Store = { plans: [], vdotHistory: [], weeks: [] };
  const failWeekCreateOnCall = { n: 0 };

  function modelsWritingTo(store: Store) {
    let weekCalls = 0;
    return {
      plan: {
        create: async ({ data }: { data: Row }) => {
          const row = { id: `plan-${store.plans.length + 1}`, ...data };
          store.plans.push(row);
          return row;
        },
      },
      vdotHistory: {
        create: async ({ data }: { data: Row }) => {
          const row = { id: `vh-${store.vdotHistory.length + 1}`, ...data };
          store.vdotHistory.push(row);
          return row;
        },
      },
      week: {
        create: async ({ data }: { data: Row & { sessions?: { create: Row[] } } }) => {
          weekCalls += 1;
          if (weekCalls === failWeekCreateOnCall.n) throw new Error("connection lost");
          const { sessions, ...rest } = data;
          const row = {
            id: `week-${store.weeks.length + 1}`,
            ...rest,
            sessions: sessions?.create ?? [],
          };
          store.weeks.push(row);
          return row;
        },
      },
    };
  }

  return { db, failWeekCreateOnCall, modelsWritingTo };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...modelsWritingTo(db),
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => {
      const staged: Store = { plans: [], vdotHistory: [], weeks: [] };
      const result = await fn(modelsWritingTo(staged));
      db.plans.push(...staged.plans);
      db.vdotHistory.push(...staged.vdotHistory);
      db.weeks.push(...staged.weeks);
      return result;
    },
  },
}));

import {
  computePlanWeeks,
  createPlan,
  generateSessions,
  splitPhases,
  validateDaysPerWeek,
  type SessionDraft,
  type Weekday,
} from "./plan-generator";
import { paceForVdot } from "./vdot";

function phaseCounts(totalWeeks: number) {
  const counts = { BASE: 0, BUILD: 0, PEAK: 0, TAPER: 0 };
  for (const week of splitPhases(totalWeeks)) counts[week.phase] += 1;
  return counts;
}

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

  describe("splitPhases", () => {
    it("splitPhases assigns taper, base, build and peak in the documented proportions for a 10-week plan", () => {
      // taper = ceil(1.0) = 1; remaining 9: build floor(3.15) = 3, peak floor(2.25) = 2, base 4.
      const weeks = splitPhases(10);
      expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(weeks.map((w) => w.phase)).toEqual([
        Phase.BASE, Phase.BASE, Phase.BASE, Phase.BASE,
        Phase.BUILD, Phase.BUILD, Phase.BUILD,
        Phase.PEAK, Phase.PEAK,
        Phase.TAPER,
      ]);
    });

    it("splitPhases assigns taper, base, build and peak in the documented proportions for an 18-week plan", () => {
      // taper = ceil(1.8) = 2; remaining 16: build floor(5.6) = 5, peak floor(4.0) = 4, base 7.
      const weeks = splitPhases(18);
      expect(weeks).toHaveLength(18);
      expect(phaseCounts(18)).toEqual({ BASE: 7, BUILD: 5, PEAK: 4, TAPER: 2 });
      expect(weeks.slice(0, 7).every((w) => w.phase === Phase.BASE)).toBe(true);
      expect(weeks.slice(7, 12).every((w) => w.phase === Phase.BUILD)).toBe(true);
      expect(weeks.slice(12, 16).every((w) => w.phase === Phase.PEAK)).toBe(true);
      expect(weeks.slice(16).every((w) => w.phase === Phase.TAPER)).toBe(true);
    });

    it("splitPhases never assigns more than 3 taper weeks", () => {
      expect(phaseCounts(30).TAPER).toBe(3);
      expect(phaseCounts(40).TAPER).toBe(3);
      expect(phaseCounts(52).TAPER).toBe(3);
    });

    it("splitPhases always assigns at least 1 taper week", () => {
      for (let totalWeeks = 1; totalWeeks <= 52; totalWeeks++) {
        const taper = phaseCounts(totalWeeks).TAPER;
        expect(taper).toBeGreaterThanOrEqual(1);
        expect(taper).toBeLessThanOrEqual(3);
      }
      expect(splitPhases(1)).toEqual([{ weekNumber: 1, phase: Phase.TAPER }]);
    });
  });

  describe("generateSessions", () => {
    const WEEK_START = new Date("2026-11-07T00:00:00Z"); // a Saturday
    const VDOT = 45;
    const DAY_SETS: Weekday[][] = [
      [1, 3, 6],
      [0, 2, 4, 6],
      [1, 2, 3, 5, 6],
      [0, 1, 2, 3, 4, 5],
    ];
    const week = (phase: Phase) => ({ weekNumber: 1, phase, startDate: WEEK_START });
    const quality = (sessions: SessionDraft[]) =>
      sessions.filter(
        (s) => s.type === SessionType.TEMPO || s.type === SessionType.INTERVAL,
      ).length;
    const total = (sessions: SessionDraft[], key: "plannedDistanceKm" | "plannedDurationMin") =>
      sessions.reduce((sum, s) => sum + s[key], 0);

    it("generateSessions places a session on each selected day only", () => {
      const sessions = generateSessions(week(Phase.BASE), [1, 3, 5], VDOT);
      expect(sessions.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
        "2026-11-09", // Monday
        "2026-11-11", // Wednesday
        "2026-11-13", // Friday
      ]);

      const weekEnd = WEEK_START.getTime() + 6 * 24 * 60 * 60 * 1000;
      for (const days of DAY_SETS) {
        for (const phase of Object.values(Phase)) {
          for (const s of generateSessions(week(phase), days, VDOT)) {
            expect(days).toContain(s.date.getUTCDay());
            expect(s.date.getTime()).toBeGreaterThanOrEqual(WEEK_START.getTime());
            expect(s.date.getTime()).toBeLessThanOrEqual(weekEnd);
          }
        }
      }
    });

    it("generateSessions creates exactly one session per selected day for 3 to 6 days", () => {
      for (const days of DAY_SETS) {
        for (const phase of Object.values(Phase)) {
          const sessions = generateSessions(week(phase), days, VDOT);
          expect(sessions).toHaveLength(days.length);
          expect(new Set(sessions.map((s) => s.date.getUTCDay()))).toEqual(new Set(days));
        }
      }
    });

    it("generateSessions weights Fácil and Longão in base and Tempo and Intervalado in build and peak", () => {
      for (const days of DAY_SETS) {
        const base = generateSessions(week(Phase.BASE), days, VDOT);
        const build = generateSessions(week(Phase.BUILD), days, VDOT);
        const peak = generateSessions(week(Phase.PEAK), days, VDOT);

        // Base: Easy/Long make up the majority of the week.
        expect(base.length - quality(base)).toBeGreaterThan(base.length / 2);
        expect(base.some((s) => s.type === SessionType.LONG)).toBe(true);
        // Build/peak: more Tempo/Interval than base for the same days.
        expect(quality(build)).toBeGreaterThan(quality(base));
        expect(quality(peak)).toBeGreaterThan(quality(base));
        expect(quality(peak)).toBeGreaterThanOrEqual(quality(build));
      }
      // With 3 days, Tempo/Interval are the majority in build and peak.
      expect(quality(generateSessions(week(Phase.BUILD), [1, 3, 6], VDOT))).toBe(2);
      expect(quality(generateSessions(week(Phase.PEAK), [1, 3, 6], VDOT))).toBe(2);
    });

    it("generateSessions reduces distance and duration in a taper week vs the equivalent non-taper week", () => {
      for (const days of DAY_SETS) {
        const taper = generateSessions(week(Phase.TAPER), days, VDOT);
        for (const phase of [Phase.BASE, Phase.BUILD, Phase.PEAK]) {
          const normal = generateSessions(week(phase), days, VDOT);
          expect(total(taper, "plannedDistanceKm")).toBeLessThan(total(normal, "plannedDistanceKm"));
          expect(total(taper, "plannedDurationMin")).toBeLessThan(total(normal, "plannedDurationMin"));
          // Same session type: the taper version is shorter.
          for (const t of taper) {
            const same = normal.find((s) => s.type === t.type);
            if (!same) continue;
            expect(t.plannedDurationMin).toBeLessThan(same.plannedDurationMin);
            expect(t.plannedDistanceKm).toBeLessThan(same.plannedDistanceKm);
          }
        }
      }
    });

    it("generateSessions reduces intensity in a taper week", () => {
      for (const days of DAY_SETS) {
        const taper = generateSessions(week(Phase.TAPER), days, VDOT);
        const peak = generateSessions(week(Phase.PEAK), days, VDOT);
        expect(quality(taper)).toBeLessThan(quality(peak));
      }
    });

    it("generateSessions derives planned pace and distance from the plan VDOT and session type", () => {
      for (const vdot of [35, 45, 60]) {
        for (const phase of Object.values(Phase)) {
          for (const s of generateSessions(week(phase), [0, 1, 2, 3, 4, 5], vdot)) {
            expect(s.plannedPaceSecPerKm).toBe(paceForVdot(vdot, s.type).secPerKm);
            // distance = duration / pace
            expect(s.plannedDistanceKm).toBeCloseTo(
              (s.plannedDurationMin * 60) / s.plannedPaceSecPerKm,
              1,
            );
          }
        }
      }
      // A fitter runner covers more ground in the same planned session.
      const slow = generateSessions(week(Phase.BUILD), [1, 3, 6], 35);
      const fast = generateSessions(week(Phase.BUILD), [1, 3, 6], 60);
      expect(total(fast, "plannedDistanceKm")).toBeGreaterThan(total(slow, "plannedDistanceKm"));
    });
  });

  describe("createPlan", () => {
    // A 10km race exactly 10 weeks out, VDOT established from a manual 5km in 19:57
    // (Daniels table: VDOT 50).
    const input = {
      userId: "user-1",
      raceType: RaceType.TEN_K,
      raceDate: new Date("2027-01-16T00:00:00Z"),
      daysPerWeek: [1, 3, 6] as Weekday[],
      vdotSource: VdotSource.MANUAL,
      result: { distanceKm: 5, timeSec: 19 * 60 + 57 },
      today: TODAY,
    };
    type WeekRow = {
      planId: string;
      weekNumber: number;
      phase: Phase;
      startDate: Date;
      endDate: Date;
      sessions: Row[];
    };

    beforeEach(() => {
      db.plans.length = 0;
      db.vdotHistory.length = 0;
      db.weeks.length = 0;
      failWeekCreateOnCall.n = 0;
    });

    it("createPlan generates a 10-week 10km plan with the expected phases and a planned pace on every session", async () => {
      const { plan, belowMinimum } = await createPlan({ ...input });

      expect(belowMinimum).toBe(false);
      expect(db.plans).toHaveLength(1);
      expect(db.plans[0]).toMatchObject({
        userId: "user-1",
        raceType: RaceType.TEN_K,
        raceDate: input.raceDate,
        daysPerWeek: [1, 3, 6],
        startDate: new Date("2026-11-07T00:00:00Z"),
      });
      expect(Math.abs((db.plans[0].initialVdot as number) - 50)).toBeLessThanOrEqual(0.1);
      expect(db.plans[0].currentVdot).toBe(db.plans[0].initialVdot);
      expect(plan).toEqual(db.plans[0]);

      const weeks = db.weeks as WeekRow[];
      expect(weeks).toHaveLength(10);
      expect(weeks.every((w) => w.planId === plan.id)).toBe(true);
      expect(weeks.map((w) => w.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // 10 weeks: taper 1; remaining 9 -> base 4, build 3, peak 2.
      expect(weeks.map((w) => w.phase)).toEqual([
        Phase.BASE, Phase.BASE, Phase.BASE, Phase.BASE,
        Phase.BUILD, Phase.BUILD, Phase.BUILD,
        Phase.PEAK, Phase.PEAK,
        Phase.TAPER,
      ]);
      weeks.forEach((w, i) => {
        expect(w.startDate).toEqual(new Date(Date.UTC(2026, 10, 7 + i * 7)));
        expect(w.endDate).toEqual(new Date(Date.UTC(2026, 10, 7 + i * 7 + 6)));
        expect(w.sessions).toHaveLength(3);
        for (const s of w.sessions) {
          expect(s.plannedPaceSecPerKm).not.toBeNull();
          expect(Number.isInteger(s.plannedPaceSecPerKm)).toBe(true);
          expect(s.plannedPaceSecPerKm as number).toBeGreaterThan(0);
        }
      });
    });

    it("createPlan records VdotHistory with source test or manual", async () => {
      for (const vdotSource of [VdotSource.TEST, VdotSource.MANUAL]) {
        db.plans.length = 0;
        db.vdotHistory.length = 0;
        db.weeks.length = 0;

        const { plan } = await createPlan({ ...input, vdotSource });

        expect(db.vdotHistory).toHaveLength(1);
        expect(db.vdotHistory[0]).toMatchObject({
          planId: plan.id,
          source: vdotSource,
          vdot: plan.initialVdot,
          date: new Date("2026-11-07T00:00:00Z"),
        });
      }
    });

    it("createPlan leaves no partial rows when generation fails mid-way", async () => {
      failWeekCreateOnCall.n = 4;

      await expect(createPlan({ ...input })).rejects.toThrow("connection lost");

      expect(db.plans).toEqual([]);
      expect(db.vdotHistory).toEqual([]);
      expect(db.weeks).toEqual([]);
    });

    it("createPlan rejects an implausible result or an invalid day count without writing anything", async () => {
      await expect(
        createPlan({ ...input, result: { distanceKm: 5, timeSec: 119 } }),
      ).rejects.toThrow();
      await expect(
        createPlan({ ...input, daysPerWeek: [1, 3] as Weekday[] }),
      ).rejects.toThrow(/3.*6/);

      expect(db.plans).toEqual([]);
      expect(db.vdotHistory).toEqual([]);
      expect(db.weeks).toEqual([]);
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
