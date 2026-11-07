import { PlanStatus, RaceType, VdotSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database, one array per table. A transaction works on a staged copy
// that replaces `db` only when the callback resolves, so a thrown error leaves `db` untouched.
type Row = Record<string, unknown>;
type Store = { plans: Row[]; vdotHistory: Row[]; raceResults: Row[] };

const { db, modelsFor } = vi.hoisted(() => {
  const db: Store = { plans: [], vdotHistory: [], raceResults: [] };
  const clone = <T,>(value: T): T => structuredClone(value);

  function modelsFor(store: Store) {
    const insert = (table: Row[], prefix: string, data: Row) => {
      const row = { id: `${prefix}-${table.length + 1}`, ...data };
      table.push(row);
      return clone(row);
    };
    return {
      plan: {
        findUniqueOrThrow: async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { raceResult?: boolean };
        }) => {
          const plan = store.plans.find((p) => p.id === where.id);
          if (!plan) throw new Error(`No plan ${where.id}`);
          if (!include?.raceResult) return clone(plan);
          const raceResult = store.raceResults.find((r) => r.planId === plan.id) ?? null;
          return clone({ ...plan, raceResult });
        },
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const plan = store.plans.find((p) => p.id === where.id)!;
          Object.assign(plan, data);
          return clone(plan);
        },
      },
      vdotHistory: {
        create: async ({ data }: { data: Row }) => insert(store.vdotHistory, "vh", data),
      },
      raceResult: {
        create: async ({ data }: { data: Row }) => insert(store.raceResults, "rr", data),
      },
    };
  }

  return { db, modelsFor };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...modelsFor(db),
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => {
      const staged = structuredClone(db);
      const result = await fn(modelsFor(staged));
      Object.assign(db, staged);
      return result;
    },
  },
}));

import { archiveIfPast, initialVdotForNewPlan, recordRaceResult } from "./plan-lifecycle";
import { calculateVdot } from "./vdot";

const TODAY = new Date("2026-11-07T15:30:00Z");

function seedPlan(overrides: Row = {}): Row {
  const plan = {
    id: `plan-${db.plans.length + 1}`,
    userId: "user-1",
    raceType: RaceType.TEN_K,
    raceDate: new Date("2027-01-16T00:00:00Z"),
    startDate: new Date("2026-09-05T00:00:00Z"),
    daysPerWeek: [1, 3, 6],
    status: PlanStatus.ACTIVE,
    initialVdot: 45,
    currentVdot: 47,
    ...overrides,
  };
  db.plans.push(plan);
  return plan;
}

describe("plan-lifecycle", () => {
  beforeEach(() => {
    db.plans = [];
    db.vdotHistory = [];
    db.raceResults = [];
  });

  describe("archiveIfPast", () => {
    it("archiveIfPast sets status to archived once raceDate is in the past", async () => {
      const yesterday = seedPlan({ raceDate: new Date("2026-11-06T00:00:00Z") });
      const lastMonth = seedPlan({ raceDate: new Date("2026-10-04T00:00:00Z") });

      await archiveIfPast(yesterday.id as string, TODAY);
      await archiveIfPast(lastMonth.id as string, TODAY);

      expect(db.plans.map((p) => p.status)).toEqual([PlanStatus.ARCHIVED, PlanStatus.ARCHIVED]);
    });

    it("archiveIfPast leaves a plan whose raceDate is today or later active", async () => {
      const future = seedPlan({ raceDate: new Date("2027-01-16T00:00:00Z") });
      const raceDay = seedPlan({ raceDate: new Date("2026-11-07T00:00:00Z") });

      await archiveIfPast(future.id as string, TODAY);
      await archiveIfPast(raceDay.id as string, TODAY);

      expect(db.plans.map((p) => p.status)).toEqual([PlanStatus.ACTIVE, PlanStatus.ACTIVE]);
    });
  });

  describe("recordRaceResult", () => {
    // Official race distances for the four supported race types (spec PLAN-08).
    const RACE_DISTANCE_KM: Record<RaceType, number> = {
      [RaceType.FIVE_K]: 5,
      [RaceType.TEN_K]: 10,
      [RaceType.HALF]: 21.0975,
      [RaceType.MARATHON]: 42.195,
    };

    it("recordRaceResult saves the result and adds a VdotHistory entry with source race", async () => {
      const raceDate = new Date("2026-11-01T00:00:00Z");
      const plan = seedPlan({ raceDate, status: PlanStatus.ARCHIVED });
      const finishTimeSec = 41 * 60 + 21; // 10km in 41:21 (Daniels table: VDOT 50)

      const entry = await recordRaceResult(plan.id as string, finishTimeSec);

      const vdot = calculateVdot(10, finishTimeSec);
      expect(Math.abs(vdot - 50)).toBeLessThanOrEqual(0.2);
      expect(db.raceResults).toHaveLength(1);
      expect(db.raceResults[0]).toMatchObject({
        planId: plan.id,
        finishTimeSec,
        date: raceDate,
        vdotComputed: vdot,
      });
      expect(db.vdotHistory).toHaveLength(1);
      expect(db.vdotHistory[0]).toMatchObject({
        planId: plan.id,
        date: raceDate,
        vdot,
        source: VdotSource.RACE,
      });
      expect(entry).toEqual(db.vdotHistory[0]);
    });

    it("recordRaceResult derives the VDOT from the plan's race distance via calculateVdot", async () => {
      const finishTimeSec = 60 * 60; // the same one-hour finish, four different races
      for (const raceType of Object.values(RaceType)) {
        const plan = seedPlan({ raceType, status: PlanStatus.ARCHIVED });
        await recordRaceResult(plan.id as string, finishTimeSec);
      }

      expect(db.raceResults.map((r) => r.vdotComputed)).toEqual(
        Object.values(RaceType).map((t) => calculateVdot(RACE_DISTANCE_KM[t], finishTimeSec)),
      );
      expect(db.vdotHistory.map((h) => h.vdot)).toEqual(
        db.raceResults.map((r) => r.vdotComputed),
      );
      expect(db.vdotHistory.every((h) => h.source === VdotSource.RACE)).toBe(true);
    });
  });

  describe("initialVdotForNewPlan", () => {
    it("initialVdotForNewPlan uses the VDOT computed from the archived plan's race result", async () => {
      const plan = seedPlan({ status: PlanStatus.ARCHIVED, currentVdot: 47 });
      await recordRaceResult(plan.id as string, 41 * 60 + 21);

      expect(await initialVdotForNewPlan(plan.id as string)).toBe(calculateVdot(10, 41 * 60 + 21));
    });

    it("initialVdotForNewPlan falls back to the archived plan's currentVdot when no race result exists", async () => {
      const plan = seedPlan({ status: PlanStatus.ARCHIVED, initialVdot: 44, currentVdot: 47.5 });

      expect(await initialVdotForNewPlan(plan.id as string)).toBe(47.5);
    });

    it("initialVdotForNewPlan returns null when there is no previous plan", async () => {
      expect(await initialVdotForNewPlan()).toBeNull();
      expect(await initialVdotForNewPlan(undefined)).toBeNull();
    });
  });
});
