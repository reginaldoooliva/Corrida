import { PlanStatus, RaceType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database, one array per table.
type Row = Record<string, unknown>;
type Store = { plans: Row[] };

const { db } = vi.hoisted(() => {
  const db: Store = { plans: [] };
  return { db };
});

vi.mock("@/lib/prisma", () => {
  const clone = <T,>(value: T): T => structuredClone(value);
  return {
    prisma: {
      plan: {
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
          const plan = db.plans.find((p) => p.id === where.id);
          if (!plan) throw new Error(`No plan ${where.id}`);
          return clone(plan);
        },
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const plan = db.plans.find((p) => p.id === where.id)!;
          Object.assign(plan, data);
          return clone(plan);
        },
      },
    },
  };
});

import { archiveIfPast } from "./plan-lifecycle";

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
    db.plans.length = 0;
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
});
