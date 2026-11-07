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
        findFirst: async ({ where }: { where: { userId: string; status: string } }) => {
          const plan = store.plans.find(
            (p) => p.userId === where.userId && p.status === where.status,
          );
          return plan ? clone(plan) : null;
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
  ActivePlanExistsError,
  archiveIfPast,
  createNewPlan,
  initialVdotForNewPlan,
  recalculateFromCurrentWeek,
  recordRaceResult,
} from "./plan-lifecycle";
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

    it("createNewPlan rejects a second active plan while one already exists", async () => {
      const existing = seedPlan({ status: PlanStatus.ACTIVE });
      const before = structuredClone(db);

      const attempt = createNewPlan(input);

      await expect(attempt).rejects.toBeInstanceOf(ActivePlanExistsError);
      await expect(attempt).rejects.toThrow(/already have an active plan/);
      expect(db).toEqual(before);
      expect(db.plans).toEqual([existing]);
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
      ).rejects.toThrow(/race date/i);

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
