import { Decision, PlanStatus, RaceType, SessionType, VdotSource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database, one array per table. A transaction works on a staged copy
// that replaces `db` only when the callback resolves, so a thrown error leaves `db` untouched.
type Row = Record<string, unknown>;
type Store = {
  plans: Row[];
  vdotHistory: Row[];
  raceResults: Row[];
  weeks: Row[];
  sessions: Row[];
  logs: Row[];
  adjustments: Row[];
};
type WeekInclude = { plan?: boolean; sessions?: boolean | { include?: { workoutLog?: boolean } } };

const { db, emptyStore, modelsFor } = vi.hoisted(() => {
  const emptyStore = (): Store => ({
    plans: [],
    vdotHistory: [],
    raceResults: [],
    weeks: [],
    sessions: [],
    logs: [],
    adjustments: [],
  });
  const db: Store = emptyStore();
  const clone = <T,>(value: T): T => structuredClone(value);
  let nextId = 0;

  function modelsFor(store: Store) {
    const insert = (table: Row[], prefix: string, data: Row) => {
      const row = { id: `${prefix}-${++nextId}`, ...data };
      table.push(row);
      return clone(row);
    };
    const byDate = (a: Row, b: Row) => (a.date as Date).getTime() - (b.date as Date).getTime();
    // Mirrors Prisma's `include` for a week: its plan and/or its sessions (date order), with logs.
    const expandWeek = (week: Row, include?: WeekInclude) => {
      const out: Row = { ...week };
      if (include?.plan) out.plan = store.plans.find((p) => p.id === week.planId);
      if (include?.sessions) {
        const withLogs = typeof include.sessions === "object" && include.sessions.include?.workoutLog;
        out.sessions = store.sessions
          .filter((s) => s.weekId === week.id)
          .sort(byDate)
          .map((s) =>
            withLogs ? { ...s, workoutLog: store.logs.find((l) => l.sessionId === s.id) ?? null } : s,
          );
      }
      return clone(out);
    };
    const idIn = (where: { id: { in: string[] } }) => (row: Row) =>
      where.id.in.includes(row.id as string);
    // Mirrors the subset of Prisma's `where` the domain uses: equality (dates by value), `in`, `lt`.
    const same = (a: unknown, b: unknown) =>
      a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : (a ?? null) === (b ?? null);
    const matches = (where: Row = {}) => (row: Row) =>
      Object.entries(where).every(([key, cond]) => {
        if (cond && typeof cond === "object" && !(cond instanceof Date)) {
          const c = cond as { in?: unknown[]; lt?: Date };
          if (c.in) return c.in.some((v) => same(row[key], v));
          if (c.lt) return (row[key] as Date).getTime() < c.lt.getTime();
        }
        return same(row[key], cond);
      });
    return {
      plan: {
        findUniqueOrThrow: async ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { raceResult?: boolean; weeks?: boolean };
        }) => {
          const plan = store.plans.find((p) => p.id === where.id);
          if (!plan) throw new Error(`No plan ${where.id}`);
          const out: Row = { ...plan };
          if (include?.raceResult) {
            out.raceResult = store.raceResults.find((r) => r.planId === plan.id) ?? null;
          }
          if (include?.weeks) out.weeks = store.weeks.filter((w) => w.planId === plan.id);
          return clone(out);
        },
        findFirst: async ({ where }: { where: Row }) => {
          const plan = store.plans.find(matches(where));
          return plan ? clone(plan) : null;
        },
        count: async ({ where }: { where: Row }) => store.plans.filter(matches(where)).length,
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const hit = store.plans.filter(matches(where));
          for (const plan of hit) Object.assign(plan, data);
          return { count: hit.length };
        },
        create: async ({ data }: { data: Row }) =>
          insert(store.plans, "plan", { status: "ACTIVE", ...data }),
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const plan = store.plans.find((p) => p.id === where.id)!;
          Object.assign(plan, data);
          return clone(plan);
        },
      },
      week: {
        create: async ({ data }: { data: Row & { sessions?: { create: Row[] } } }) => {
          const { sessions, ...rest } = data;
          const week = insert(store.weeks, "week", { reassessedAt: null, ...rest });
          for (const s of sessions?.create ?? []) insert(store.sessions, "s", { weekId: week.id, ...s });
          return week;
        },
        findMany: async ({ where, include }: { where: { planId: string }; include?: WeekInclude }) =>
          store.weeks.filter((w) => w.planId === where.planId).map((w) => expandWeek(w, include)),
        findUniqueOrThrow: async ({ where, include }: { where: { id: string }; include?: WeekInclude }) => {
          const week = store.weeks.find((w) => w.id === where.id);
          if (!week) throw new Error(`No week ${where.id}`);
          return expandWeek(week, include);
        },
        findFirst: async ({
          where,
          include,
        }: {
          where: { planId: string; weekNumber: number };
          include?: WeekInclude;
        }) => {
          const week = store.weeks.find(
            (w) => w.planId === where.planId && w.weekNumber === where.weekNumber,
          );
          return week ? expandWeek(week, include) : null;
        },
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const week = store.weeks.find((w) => w.id === where.id)!;
          Object.assign(week, data);
          return clone(week);
        },
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const hit = store.weeks.filter(matches(where));
          for (const week of hit) Object.assign(week, data);
          return { count: hit.length };
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          // Mirrors the foreign keys: a week still holding sessions cannot be deleted.
          const doomed = store.weeks.filter(idIn(where));
          if (doomed.some((w) => store.sessions.some((s) => s.weekId === w.id))) {
            throw new Error("Foreign key violation: Session.weekId");
          }
          store.weeks = store.weeks.filter((w) => !doomed.includes(w));
          return { count: doomed.length };
        },
      },
      session: {
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const session = store.sessions.find((s) => s.id === where.id)!;
          Object.assign(session, data);
          return clone(session);
        },
        createMany: async ({ data }: { data: Row[] }) => {
          for (const s of data) insert(store.sessions, "s", s);
          return { count: data.length };
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          // Mirrors the foreign key: a session with a WorkoutLog cannot be deleted.
          const doomed = store.sessions.filter(idIn(where));
          if (doomed.some((s) => store.logs.some((l) => l.sessionId === s.id))) {
            throw new Error("Foreign key violation: WorkoutLog.sessionId");
          }
          store.sessions = store.sessions.filter((s) => !doomed.includes(s));
          return { count: doomed.length };
        },
      },
      weeklyAdjustment: {
        create: async ({ data }: { data: Row }) => insert(store.adjustments, "adj", data),
      },
      vdotHistory: {
        create: async ({ data }: { data: Row }) => insert(store.vdotHistory, "vh", data),
      },
      raceResult: {
        create: async ({ data }: { data: Row }) => insert(store.raceResults, "rr", data),
      },
    };
  }

  return { db, emptyStore, modelsFor };
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

import { createPlan, splitPhases, type Weekday } from "./plan-generator";
import {
  archiveIfPast,
  archivePastPlans,
  createNewPlan,
  followPlan,
  initialVdotForNewPlan,
  isPlausibleRaceTime,
  PLAN_LIMIT_ERROR,
  PlanConflictError,
  PlanLimitError,
  PlanNotFoundError,
  recalculateFromCurrentWeek,
  recordRaceResult,
} from "./plan-lifecycle";
import { prisma } from "@/lib/prisma";
import { calculateVdot, paceForVdot } from "./vdot";
import { reassessIfDue } from "./weekly-adjustment";

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
    Object.assign(db, emptyStore());
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

    it("archiveIfPast archives a paused plan once its race date has passed", async () => {
      const pausedPast = seedPlan({ status: PlanStatus.PAUSED, raceDate: new Date("2026-11-06T00:00:00Z") });
      const pausedRaceDay = seedPlan({ status: PlanStatus.PAUSED, raceDate: new Date("2026-11-07T00:00:00Z") });

      await archiveIfPast(pausedPast.id as string, TODAY);
      await archiveIfPast(pausedRaceDay.id as string, TODAY);

      expect(db.plans.map((p) => p.status)).toEqual([PlanStatus.ARCHIVED, PlanStatus.PAUSED]);
    });
  });

  describe("archivePastPlans", () => {
    it("archivePastPlans archives active and paused plans whose race date has passed", async () => {
      const past = new Date("2026-11-06T00:00:00Z"); // the day before TODAY
      seedPlan({ status: PlanStatus.ACTIVE, raceDate: past });
      seedPlan({ status: PlanStatus.PAUSED, raceDate: new Date("2026-10-04T00:00:00Z") });
      seedPlan({ status: PlanStatus.PAUSED, raceDate: new Date("2026-11-07T00:00:00Z") }); // race day
      seedPlan({ status: PlanStatus.PAUSED, raceDate: new Date("2027-01-16T00:00:00Z") });
      seedPlan({ status: PlanStatus.ACTIVE, raceDate: past, userId: "user-2" }); // someone else's

      await archivePastPlans("user-1", TODAY);

      expect(db.plans.map((p) => p.status)).toEqual([
        PlanStatus.ARCHIVED,
        PlanStatus.ARCHIVED,
        PlanStatus.PAUSED,
        PlanStatus.PAUSED,
        PlanStatus.ACTIVE,
      ]);
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

    it("isPlausibleRaceTime judges a finish time against the race's own distance", () => {
      // 41:21 is a real 10km (VDOT 50) but no human runs a marathon in it; 0s is no time at all.
      expect(isPlausibleRaceTime(RaceType.TEN_K, 41 * 60 + 21)).toBe(true);
      expect(isPlausibleRaceTime(RaceType.MARATHON, 41 * 60 + 21)).toBe(false);
      expect(isPlausibleRaceTime(RaceType.MARATHON, 3 * 3600 + 10 * 60)).toBe(true);
      expect(isPlausibleRaceTime(RaceType.TEN_K, 0)).toBe(false);
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

  describe("createNewPlan", () => {
    // A 10km race 10 weeks out, from a manual 5km in 19:57.
    const input = {
      userId: "user-1",
      raceType: RaceType.TEN_K,
      raceDate: new Date("2027-01-16T00:00:00Z"),
      daysPerWeek: [1, 3, 6] as Weekday[],
      vdotSource: VdotSource.MANUAL,
      result: { distanceKm: 5, timeSec: 19 * 60 + 57 },
      today: TODAY,
    };

    // Spec PLANS-04 (AD-005 replaces LIFE-06, which refused a second plan while one was active).
    it("createNewPlan makes the new plan active and the previous one paused", async () => {
      const previous = seedPlan({ status: PlanStatus.ACTIVE });

      const { plan } = await createNewPlan(input);

      expect(db.plans.map((p) => [p.id, p.status])).toEqual([
        [previous.id, PlanStatus.PAUSED],
        [plan.id, PlanStatus.ACTIVE],
      ]);
    });

    it("createPlan pauses the active plan so at most one stays active", async () => {
      seedPlan({ status: PlanStatus.ACTIVE });
      seedPlan({ status: PlanStatus.PAUSED });
      const otherUsers = seedPlan({ status: PlanStatus.ACTIVE, userId: "user-2" });

      const { plan } = await createPlan(input);

      const active = db.plans.filter((p) => p.userId === "user-1" && p.status === PlanStatus.ACTIVE);
      expect(active.map((p) => p.id)).toEqual([plan.id]);
      expect(db.plans.filter((p) => p.status === PlanStatus.PAUSED)).toHaveLength(2);
      expect(db.plans.find((p) => p.id === otherUsers.id)?.status).toBe(PlanStatus.ACTIVE);
    });

    it("createNewPlan counts only active and paused plans toward the limit of 3", async () => {
      seedPlan({ status: PlanStatus.ACTIVE });
      seedPlan({ status: PlanStatus.PAUSED });
      seedPlan({ status: PlanStatus.ARCHIVED });
      seedPlan({ status: PlanStatus.ARCHIVED });
      seedPlan({ status: PlanStatus.PAUSED, userId: "user-2" });

      // Two kept plans (archived ones and another user's do not count): a third is allowed.
      const { plan: third } = await createNewPlan(input);
      expect(db.plans.find((p) => p.id === third.id)?.status).toBe(PlanStatus.ACTIVE);

      // Three kept plans now: a fourth is refused with the PLANS-03 text and nothing is written.
      const before = structuredClone(db);
      const attempt = createNewPlan(input);
      await expect(attempt).rejects.toBeInstanceOf(PlanLimitError);
      await expect(attempt).rejects.toThrow("Você já tem 3 planos. Exclua um para criar outro.");
      expect(PLAN_LIMIT_ERROR).toBe("Você já tem 3 planos. Exclua um para criar outro.");
      expect(db).toEqual(before);
    });

    it("createNewPlan reports a concurrent second active plan (unique index, P2002) as a plan conflict", async () => {
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed on the fields: (`userId`)"), { code: "P2002" }),
      );

      const attempt = createNewPlan(input);

      await expect(attempt).rejects.toBeInstanceOf(PlanConflictError);
    });

    it("createNewPlan creates the plan when no plan is active", async () => {
      seedPlan({ status: PlanStatus.ARCHIVED });

      const { plan } = await createNewPlan(input);

      expect(db.plans).toHaveLength(2);
      expect(db.plans[1]).toMatchObject({
        id: plan.id,
        userId: "user-1",
        raceType: RaceType.TEN_K,
        status: PlanStatus.ACTIVE,
      });
      expect(db.weeks.filter((w) => w.planId === plan.id)).toHaveLength(10);
      expect(db.vdotHistory).toEqual([
        expect.objectContaining({ planId: plan.id, source: VdotSource.MANUAL }),
      ]);
    });
  });

  describe("followPlan", () => {
    // A 10km plan started 2026-10-24, paused when a second plan was created; "today" is 20 days
    // after the start, so week 1 (ends 10-30) and week 2 (ends 11-06) ended while it was paused and
    // week 3 ends today.
    const PLAN_START = new Date("2026-10-24T00:00:00Z");
    const FOLLOW_DAY = new Date("2026-11-13T09:00:00Z");
    const planInput = {
      userId: "user-1",
      raceType: RaceType.TEN_K,
      raceDate: new Date("2027-01-16T00:00:00Z"),
      daysPerWeek: [1, 3, 6] as Weekday[],
      vdotSource: VdotSource.MANUAL,
      result: { distanceKm: 5, timeSec: 21 * 60 + 25 },
    };
    let pausedId: string;
    let activeId: string;

    beforeEach(async () => {
      pausedId = (await createNewPlan({ ...planInput, today: PLAN_START })).plan.id;
      activeId = (await createNewPlan({ ...planInput, today: new Date("2026-11-10T00:00:00Z") })).plan.id;
    });

    const statusOf = (id: string) => db.plans.find((p) => p.id === id)?.status;

    it("followPlan makes the paused plan active and the active one paused", async () => {
      expect([statusOf(pausedId), statusOf(activeId)]).toEqual([PlanStatus.PAUSED, PlanStatus.ACTIVE]);

      expect(await followPlan("user-1", pausedId, FOLLOW_DAY)).toBe("active");

      expect([statusOf(pausedId), statusOf(activeId)]).toEqual([PlanStatus.ACTIVE, PlanStatus.PAUSED]);
    });

    it("followPlan marks the plan's ended weeks reassessed without a WeeklyAdjustment", async () => {
      const sessionsBefore = structuredClone(db.sessions);

      await followPlan("user-1", pausedId, FOLLOW_DAY);

      const weeks = db.weeks
        .filter((w) => w.planId === pausedId)
        .sort((a, b) => (a.weekNumber as number) - (b.weekNumber as number));
      expect(weeks[0].reassessedAt).toBeInstanceOf(Date);
      expect(weeks[1].reassessedAt).toBeInstanceOf(Date);
      // Week 3 ends today: still open, and every later week too.
      expect(weeks.slice(2).every((w) => w.reassessedAt === null)).toBe(true);
      expect(db.adjustments).toEqual([]);
      expect(db.sessions).toEqual(sessionsBefore);
      // The plan that was paused instead keeps its weeks as they were.
      expect(db.weeks.filter((w) => w.planId === activeId).every((w) => w.reassessedAt === null)).toBe(true);
    });

    it("followPlan archives a paused plan whose race has passed instead of following it", async () => {
      db.plans.find((p) => p.id === pausedId)!.raceDate = new Date("2026-11-12T00:00:00Z");

      expect(await followPlan("user-1", pausedId, FOLLOW_DAY)).toBe("archived");

      expect([statusOf(pausedId), statusOf(activeId)]).toEqual([PlanStatus.ARCHIVED, PlanStatus.ACTIVE]);
    });

    it("followPlan refuses a concurrent second activation without changing anything", async () => {
      const before = structuredClone(db);
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed on the fields: (`userId`)"), { code: "P2002" }),
      );

      await expect(followPlan("user-1", pausedId, FOLLOW_DAY)).rejects.toBeInstanceOf(PlanConflictError);

      expect(db).toEqual(before);
      expect(db.plans.filter((p) => p.status === PlanStatus.ACTIVE).map((p) => p.id)).toEqual([activeId]);
    });
  });

  describe("refusals", () => {
    it("followPlan, deletePlan and deleteSession refuse an id that is not the user's or does not exist", async () => {
      const mine = seedPlan({ status: PlanStatus.PAUSED });
      const theirs = seedPlan({ status: PlanStatus.PAUSED, userId: "user-2" });
      const archived = seedPlan({ status: PlanStatus.ARCHIVED });
      const before = structuredClone(db);

      for (const id of [theirs.id as string, "no-such-plan", archived.id as string]) {
        await expect(followPlan("user-1", id, TODAY)).rejects.toBeInstanceOf(PlanNotFoundError);
      }
      await expect(followPlan("user-2", mine.id as string, TODAY)).rejects.toThrow("Plano não encontrado.");

      expect(db).toEqual(before);
    });
  });

  describe("recalculateFromCurrentWeek", () => {
    // A 12-week 10km plan started on Saturday 2026-10-24 (Mon/Wed/Sat). "Today" is Sunday
    // 2026-11-08, inside week 3: weeks 1-2 are past and fully logged, week 1 already reassessed,
    // week 2 ended but not yet reassessed (its RPE 9 logs would make it a `maintain` week), and
    // week 3's Saturday session is already logged.
    const PLAN_START = new Date("2026-10-24T00:00:00Z");
    const EDIT_DAY = new Date("2026-11-08T10:00:00Z");
    const CURRENT_WEEK = 3;
    let planId: string;

    const weekNo = (n: number) => db.weeks.find((w) => w.planId === planId && w.weekNumber === n)!;
    const sessionsOf = (n: number) =>
      db.sessions
        .filter((s) => s.weekId === weekNo(n).id)
        .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
    const logOf = (s: Row) => db.logs.find((l) => l.sessionId === s.id);
    const pastSnapshot = () =>
      structuredClone([1, 2].flatMap((n) => sessionsOf(n).map((s) => ({ s, log: logOf(s) }))));

    beforeEach(async () => {
      const { plan } = await createPlan({
        userId: "user-1",
        raceType: RaceType.TEN_K,
        raceDate: new Date("2027-01-16T00:00:00Z"),
        daysPerWeek: [1, 3, 6],
        vdotSource: VdotSource.MANUAL,
        result: { distanceKm: 5, timeSec: 21 * 60 + 25 }, // VDOT ~46
        today: PLAN_START,
      });
      planId = plan.id;
      db.plans[0].currentVdot = 52; // later retests raised it
      weekNo(1).reassessedAt = new Date("2026-10-31T08:00:00Z");

      const log = (s: Row, rpe: number) =>
        db.logs.push({
          id: `log-${db.logs.length + 1}`,
          sessionId: s.id,
          actualPaceSecPerKm: s.plannedPaceSecPerKm,
          actualDistanceKm: s.plannedDistanceKm,
          actualDurationMin: s.plannedDurationMin,
          rpe,
          notes: null,
          loggedAt: s.date,
        });
      for (const s of sessionsOf(1)) log(s, 5);
      for (const s of sessionsOf(2)) log(s, 9);
      log(sessionsOf(CURRENT_WEEK)[0], 6); // Saturday 2026-11-07
    });

    it("recalculateFromCurrentWeek regenerates only future weeks and leaves past WorkoutLogs untouched", async () => {
      const past = pastSnapshot();
      const logsBefore = structuredClone(db.logs);
      const newDays: Weekday[] = [0, 2, 4, 6];

      await recalculateFromCurrentWeek(planId, { days: newDays }, EDIT_DAY);

      // Past weeks: same sessions, same logs, byte for byte; no WorkoutLog anywhere was lost.
      expect(pastSnapshot()).toEqual(past);
      expect(db.logs).toEqual(logsBefore);
      expect(db.plans[0].daysPerWeek).toEqual(newDays);

      // Current week: the logged Saturday stays and the other new days are filled in.
      const current = sessionsOf(CURRENT_WEEK);
      expect(current.map((s) => (s.date as Date).toISOString().slice(0, 10))).toEqual([
        "2026-11-07", "2026-11-08", "2026-11-10", "2026-11-12",
      ]);
      expect(logOf(current[0])).toEqual(logsBefore[logsBefore.length - 1]);

      // Every later week sits on exactly the new days.
      const weekNumbers = db.weeks.map((w) => w.weekNumber as number).sort((a, b) => a - b);
      expect(weekNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      for (let n = CURRENT_WEEK + 1; n <= 12; n++) {
        expect(sessionsOf(n).map((s) => (s.date as Date).getUTCDay()).sort()).toEqual(newDays);
      }
    });

    it("recalculateFromCurrentWeek re-derives future sessions from currentVdot, not initialVdot", async () => {
      const phasesBefore = [1, 2].map((n) => weekNo(n).phase);

      // Race moved 3 weeks later: 15 weeks from the plan start.
      await recalculateFromCurrentWeek(
        planId,
        { raceDate: new Date("2027-02-06T00:00:00Z") },
        EDIT_DAY,
      );

      expect(db.plans[0].raceDate).toEqual(new Date("2027-02-06T00:00:00Z"));
      expect(db.weeks.filter((w) => w.planId === planId)).toHaveLength(15);
      // Phases re-proportioned over the new length; past weeks keep theirs.
      expect([1, 2].map((n) => weekNo(n).phase)).toEqual(phasesBefore);
      for (const { weekNumber, phase } of splitPhases(15).slice(CURRENT_WEEK - 1)) {
        expect(weekNo(weekNumber).phase).toBe(phase);
      }

      const initialVdot = db.plans[0].initialVdot as number;
      for (let n = CURRENT_WEEK; n <= 15; n++) {
        for (const s of sessionsOf(n).filter((s) => !logOf(s))) {
          const type = s.type as SessionType;
          expect(s.plannedPaceSecPerKm).toBe(paceForVdot(52, type).secPerKm);
          expect(s.plannedPaceSecPerKm).not.toBe(paceForVdot(initialVdot, type).secPerKm);
        }
      }
    });

    it("recalculateFromCurrentWeek rejects an invalid day count with the plan-creation message, and a race date leaving no week", async () => {
      const before = structuredClone(db);
      const creationError = await createPlan({
        userId: "user-1",
        raceType: RaceType.TEN_K,
        raceDate: new Date("2027-01-16T00:00:00Z"),
        daysPerWeek: [1, 3],
        vdotSource: VdotSource.MANUAL,
        result: { distanceKm: 5, timeSec: 21 * 60 + 25 },
        today: PLAN_START,
      }).then(
        () => "",
        (e: Error) => e.message,
      );
      expect(creationError).toMatch(/3.*6/);

      for (const days of [[1, 3], [0, 1, 2, 3, 4, 5, 6]] as Weekday[][]) {
        await expect(recalculateFromCurrentWeek(planId, { days }, EDIT_DAY)).rejects.toThrow(
          creationError,
        );
      }
      // Race date before the current week: nothing would be left to train for.
      await expect(
        recalculateFromCurrentWeek(planId, { raceDate: new Date("2026-11-06T00:00:00Z") }, EDIT_DAY),
      ).rejects.toThrow(/data da prova/i);

      expect(db).toEqual(before);
    });

    it("recalculateFromCurrentWeek settles the ended week's pending reassessment so it never pairs weeks with different day counts", async () => {
      await recalculateFromCurrentWeek(planId, { days: [0, 2, 4, 6] }, EDIT_DAY);

      // Week 2 was reassessed before the regeneration (one row, `maintain` from its RPE signal).
      expect(weekNo(2).reassessedAt).toBeInstanceOf(Date);
      expect(db.adjustments).toEqual([
        expect.objectContaining({ weekId: weekNo(2).id, decision: Decision.MAINTAIN, rpeTriggered: true }),
      ]);

      // The dashboard's later reassessment of week 2 is a no-op: the regenerated week 3 keeps its
      // new days instead of being overwritten by a clone of the 3-day week 2.
      const currentAfterEdit = structuredClone(sessionsOf(CURRENT_WEEK));
      expect(await reassessIfDue(weekNo(2).id as string)).toBeNull();
      expect(sessionsOf(CURRENT_WEEK)).toEqual(currentAfterEdit);
      expect(db.adjustments).toHaveLength(1);
      // From the current week on, adjacent weeks share the same day count.
      expect(sessionsOf(CURRENT_WEEK)).toHaveLength(sessionsOf(CURRENT_WEEK + 1).length);
    });
  });
});
