import { Decision, Phase, SessionType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the database. A transaction works on a staged copy that replaces `db` only
// when the callback resolves, so a thrown error (e.g. a unique violation) leaves `db` untouched.
type Row = Record<string, unknown>;
type Store = { plan: Row; weeks: Row[]; adjustments: Row[] };

const { db, modelsFor } = vi.hoisted(() => {
  const db: Store = { plan: {}, weeks: [], adjustments: [] };

  function modelsFor(store: Store, uniqueViolation: () => Error) {
    const clone = <T,>(value: T): T => structuredClone(value);
    return {
      week: {
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
          const week = store.weeks.find((w) => w.id === where.id);
          if (!week) throw new Error(`No week ${where.id}`);
          return clone({ ...week, plan: store.plan });
        },
        findFirst: async ({ where }: { where: { planId: string; weekNumber: number } }) => {
          const week = store.weeks.find(
            (w) => w.planId === where.planId && w.weekNumber === where.weekNumber,
          );
          return week ? clone(week) : null;
        },
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const week = store.weeks.find((w) => w.id === where.id)!;
          Object.assign(week, data);
          return clone(week);
        },
      },
      session: {
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const session = store.weeks
            .flatMap((w) => w.sessions as Row[])
            .find((s) => s.id === where.id)!;
          Object.assign(session, data);
          return clone(session);
        },
      },
      weeklyAdjustment: {
        // Mirrors the `@unique` on WeeklyAdjustment.weekId.
        create: async ({ data }: { data: Row }) => {
          if (store.adjustments.some((a) => a.weekId === data.weekId)) throw uniqueViolation();
          const row = { id: `adj-${store.adjustments.length + 1}`, computedAt: new Date(), ...data };
          store.adjustments.push(row);
          return clone(row);
        },
      },
    };
  }

  return { db, modelsFor };
});

vi.mock("@/lib/prisma", async () => {
  const { Prisma } = await import("@prisma/client");
  const uniqueViolation = () =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`weekId`)", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
  return {
    prisma: {
      $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => {
        const staged = structuredClone(db);
        const result = await fn(modelsFor(staged, uniqueViolation));
        Object.assign(db, staged);
        return result;
      },
    },
  };
});

import { generateSessions, type SessionDraft, type Weekday } from "./plan-generator";
import { paceForVdot } from "./vdot";
import {
  applyDecision,
  computeSignals,
  decide,
  isWeekDue,
  reassessIfDue,
} from "./weekly-adjustment";

const DAY_MS = 24 * 60 * 60 * 1000;

// A session as computeSignals sees it: its planned pace and, if logged, the actual pace and RPE.
const logged = (planned: number, actual: number, rpe: number) => ({
  plannedPaceSecPerKm: planned,
  workoutLog: { actualPaceSecPerKm: actual, rpe },
});
const unlogged = (planned: number) => ({ plannedPaceSecPerKm: planned, workoutLog: null });

describe("weekly-adjustment", () => {
  describe("computeSignals", () => {
    it("computeSignals flags pace, RPE and missed-ratio at their documented thresholds", () => {
      // Pace exactly 5% slower (avg planned 300, avg actual 315), RPE avg exactly 8,
      // missed exactly 1 of 4 planned sessions (25%). The unlogged session's planned pace (400) is
      // left out of the planned average: averaging it in (325) would make 315 faster, not slower.
      const week = {
        sessions: [logged(280, 294, 7), logged(300, 315, 8), logged(320, 336, 9), unlogged(400)],
      };
      expect(computeSignals(week)).toEqual({ paceDeviation: true, rpe: true, missed: true });
    });

    it("computeSignals flips the pace signal at 5% slower than the planned average", () => {
      const below = { sessions: [logged(300, 314, 5), logged(300, 314, 5)] }; // 4.7% slower
      const at = { sessions: [logged(300, 315, 5), logged(300, 315, 5)] }; // 5.0% slower
      const faster = { sessions: [logged(300, 280, 5), logged(300, 290, 5)] };
      expect(computeSignals(below)).toEqual({ paceDeviation: false, rpe: false, missed: false });
      expect(computeSignals(at)).toEqual({ paceDeviation: true, rpe: false, missed: false });
      expect(computeSignals(faster).paceDeviation).toBe(false);
    });

    it("computeSignals flips the RPE signal at an average RPE of 8", () => {
      const below = { sessions: [logged(300, 300, 8), logged(300, 300, 8), logged(300, 300, 8), logged(300, 300, 7)] }; // 7.75
      const at = { sessions: [logged(300, 300, 7), logged(300, 300, 9)] }; // 8.0
      expect(computeSignals(below)).toEqual({ paceDeviation: false, rpe: false, missed: false });
      expect(computeSignals(at)).toEqual({ paceDeviation: false, rpe: true, missed: false });
    });

    it("computeSignals flips the missed signal at 25% of planned sessions", () => {
      const below = {
        sessions: [logged(300, 300, 5), logged(300, 300, 5), logged(300, 300, 5), logged(300, 300, 5), unlogged(300)],
      }; // 1 of 5 = 20%
      const at = {
        sessions: [logged(300, 300, 5), logged(300, 300, 5), logged(300, 300, 5), unlogged(300)],
      }; // 1 of 4 = 25%
      expect(computeSignals(below)).toEqual({ paceDeviation: false, rpe: false, missed: false });
      expect(computeSignals(at)).toEqual({ paceDeviation: false, rpe: false, missed: true });
    });

    it("a week with zero logs resolves missed=true and pace/RPE as not-triggered", () => {
      const week = { sessions: [unlogged(300), unlogged(280), unlogged(330)] };
      expect(computeSignals(week)).toEqual({ paceDeviation: false, rpe: false, missed: true });
    });
  });

  describe("decide", () => {
    // Spec ADJ-02..04: 0 signals -> progress, exactly 1 -> maintain, 2 or 3 -> reduce.
    it.each([
      [false, false, false, Decision.PROGRESS],
      [true, false, false, Decision.MAINTAIN],
      [false, true, false, Decision.MAINTAIN],
      [false, false, true, Decision.MAINTAIN],
      [true, true, false, Decision.REDUCE],
      [true, false, true, Decision.REDUCE],
      [false, true, true, Decision.REDUCE],
      [true, true, true, Decision.REDUCE],
    ])("decide maps pace=%s rpe=%s missed=%s to %s", (paceDeviation, rpe, missed, expected) => {
      expect(decide({ paceDeviation, rpe, missed })).toBe(expected);
    });
  });

  describe("applyDecision", () => {
    const VDOT = 45;
    const DAYS: Weekday[] = [1, 3, 5, 6];
    const CURRENT_START = new Date("2026-11-08T00:00:00Z");
    const NEXT_START = new Date(CURRENT_START.getTime() + 7 * DAY_MS);
    // Current week is a build week; the originally generated next week is a peak week.
    const currentWeek = generateSessions(
      { weekNumber: 5, phase: Phase.BUILD, startDate: CURRENT_START },
      DAYS,
      VDOT,
    );
    const nextWeek = () =>
      generateSessions({ weekNumber: 6, phase: Phase.PEAK, startDate: NEXT_START }, DAYS, VDOT);

    it("decide returns reduce and applyDecision cuts distance 20% and steps intensity down", () => {
      const decision = decide({ paceDeviation: true, rpe: true, missed: false });
      expect(decision).toBe(Decision.REDUCE);

      const original = nextWeek();
      expect(original.map((s) => s.type)).toEqual([
        SessionType.INTERVAL, SessionType.EASY, SessionType.TEMPO, SessionType.LONG,
      ]);
      const reduced = applyDecision(decision, nextWeek(), { currentWeek, vdot: VDOT });

      const stepDown: Record<SessionType, SessionType> = {
        [SessionType.INTERVAL]: SessionType.TEMPO,
        [SessionType.TEMPO]: SessionType.EASY,
        [SessionType.EASY]: SessionType.EASY,
        [SessionType.LONG]: SessionType.LONG,
      };
      expect(reduced).toHaveLength(original.length);
      reduced.forEach((s, i) => {
        const o = original[i];
        expect(s.date).toEqual(o.date);
        expect(s.plannedDistanceKm).toBeCloseTo(o.plannedDistanceKm * 0.8, 2);
        expect(s.plannedDurationMin).toBe(Math.round(o.plannedDurationMin * 0.8));
        expect(s.type).toBe(stepDown[o.type]);
        expect(s.plannedPaceSecPerKm).toBe(paceForVdot(VDOT, stepDown[o.type]).secPerKm);
      });
      // Interval now runs at Tempo pace, Tempo at Easy pace; Easy/Long keep their pace.
      expect(reduced[0].plannedPaceSecPerKm).toBe(paceForVdot(VDOT, SessionType.TEMPO).secPerKm);
      expect(reduced[2].plannedPaceSecPerKm).toBe(paceForVdot(VDOT, SessionType.EASY).secPerKm);
      expect(reduced[1].plannedPaceSecPerKm).toBe(original[1].plannedPaceSecPerKm);
      expect(reduced[3].plannedPaceSecPerKm).toBe(original[3].plannedPaceSecPerKm);
    });

    it("decide returns maintain and applyDecision clones the current week unchanged", () => {
      const decision = decide({ paceDeviation: false, rpe: true, missed: false });
      expect(decision).toBe(Decision.MAINTAIN);

      const draft = nextWeek();
      const maintained = applyDecision(decision, draft, { currentWeek, vdot: VDOT });

      expect(maintained).toHaveLength(currentWeek.length);
      maintained.forEach((s, i) => {
        const c = currentWeek[i];
        expect(s.type).toBe(c.type);
        expect(s.plannedPaceSecPerKm).toBe(c.plannedPaceSecPerKm);
        expect(s.plannedDistanceKm).toBe(c.plannedDistanceKm);
        expect(s.plannedDurationMin).toBe(c.plannedDurationMin);
        // Same weekday, one week later: the next week's own dates.
        expect(s.date).toEqual(new Date(c.date.getTime() + 7 * DAY_MS));
        expect(s.date).toEqual(draft[i].date);
      });
      // Periodization does not advance: the peak week's types are not used.
      expect(maintained.map((s) => s.type)).not.toEqual(draft.map((s) => s.type));
    });

    it("maintain matches sessions by weekday when either week has a deleted session", () => {
      // DAYS are Mon/Wed/Fri/Sat. The next week lost its Wednesday; the current week its Monday.
      const draft = nextWeek().filter((s) => s.date.getUTCDay() !== 3);
      const current = currentWeek.filter((s) => s.date.getUTCDay() !== 1);

      const maintained = applyDecision(Decision.MAINTAIN, draft, { currentWeek: current, vdot: VDOT });

      // Every next-week session stays on its own day.
      expect(maintained.map((s) => s.date)).toEqual(draft.map((s) => s.date));
      // Friday and Saturday take the current week's Friday and Saturday sessions.
      for (const weekday of [5, 6]) {
        const m = maintained.find((s) => s.date.getUTCDay() === weekday)!;
        const c = current.find((s) => s.date.getUTCDay() === weekday)!;
        expect({ ...m, date: c.date }).toEqual(c);
      }
      // Monday has no current-week session to copy and stays as generated.
      expect(maintained.find((s) => s.date.getUTCDay() === 1)).toEqual(draft.find((s) => s.date.getUTCDay() === 1));
    });

    it("decide returns progress and leaves the next week as originally generated", () => {
      const decision = decide({ paceDeviation: false, rpe: false, missed: false });
      expect(decision).toBe(Decision.PROGRESS);

      const progressed = applyDecision(decision, nextWeek(), { currentWeek, vdot: VDOT });
      expect(progressed).toEqual(nextWeek());
    });
  });

  describe("isWeekDue", () => {
    it("a week is due the day after its last day, not on it, and never twice", () => {
      const endDate = new Date("2026-11-08T00:00:00Z");
      expect(isWeekDue({ endDate, reassessedAt: null }, new Date("2026-11-07T00:00:00Z"))).toBe(false);
      expect(isWeekDue({ endDate, reassessedAt: null }, endDate)).toBe(false);
      expect(isWeekDue({ endDate, reassessedAt: null }, new Date("2026-11-09T00:00:00Z"))).toBe(true);
      expect(isWeekDue({ endDate, reassessedAt: new Date() }, new Date("2026-11-20T00:00:00Z"))).toBe(false);
    });
  });

  describe("reassessIfDue", () => {
    const VDOT = 45;
    const DAYS: Weekday[] = [1, 3, 5, 6];
    const WEEK5_START = new Date("2026-11-08T00:00:00Z");
    const WEEK6_START = new Date(WEEK5_START.getTime() + 7 * DAY_MS);

    type Log = { actualPaceSecPerKm: number; rpe: number };
    const draftFields = (s: Row): SessionDraft => ({
      date: s.date as Date,
      type: s.type as SessionType,
      plannedPaceSecPerKm: s.plannedPaceSecPerKm as number,
      plannedDistanceKm: s.plannedDistanceKm as number,
      plannedDurationMin: s.plannedDurationMin as number,
    });
    const week6Sessions = () => (db.weeks[1].sessions as Row[]).map(draftFields);

    // Week 5 (ended, every session logged by `logFor`) followed by an originally generated week 6.
    function seed(logFor: (planned: SessionDraft) => Log) {
      const sessionsOf = (weekId: string, drafts: SessionDraft[], withLogs: boolean) =>
        drafts.map((d, i) => ({
          id: `${weekId}-s${i + 1}`,
          weekId,
          ...d,
          workoutLog: withLogs
            ? { id: `${weekId}-log${i + 1}`, sessionId: `${weekId}-s${i + 1}`, ...logFor(d) }
            : null,
        }));
      const week5 = generateSessions({ weekNumber: 5, phase: Phase.BUILD, startDate: WEEK5_START }, DAYS, VDOT);
      const week6 = generateSessions({ weekNumber: 6, phase: Phase.PEAK, startDate: WEEK6_START }, DAYS, VDOT);
      db.plan = { id: "plan-1", currentVdot: VDOT, initialVdot: 42 };
      db.adjustments = [];
      db.weeks = [
        {
          id: "week-5", planId: "plan-1", weekNumber: 5, phase: Phase.BUILD,
          startDate: WEEK5_START, endDate: new Date(WEEK5_START.getTime() + 6 * DAY_MS),
          reassessedAt: null, sessions: sessionsOf("week-5", week5, true),
        },
        {
          id: "week-6", planId: "plan-1", weekNumber: 6, phase: Phase.PEAK,
          startDate: WEEK6_START, endDate: new Date(WEEK6_START.getTime() + 6 * DAY_MS),
          reassessedAt: null, sessions: sessionsOf("week-6", week6, false),
        },
      ];
      return { week5, week6 };
    }
    // Every session logged ~10% slower than planned at RPE 8-9: pace and RPE signals, none missed.
    const fatigued = (d: SessionDraft): Log => ({
      actualPaceSecPerKm: Math.round(d.plannedPaceSecPerKm * 1.1),
      rpe: d.type === SessionType.LONG ? 9 : 8,
    });
    const fresh = (d: SessionDraft): Log => ({ actualPaceSecPerKm: d.plannedPaceSecPerKm, rpe: 5 });

    beforeEach(() => {
      db.weeks = [];
      db.adjustments = [];
    });

    it("reassessIfDue persists a WeeklyAdjustment row with its signals, decision and percentage", async () => {
      const { week5, week6 } = seed(fatigued);

      const result = await reassessIfDue("week-5");

      expect(db.adjustments).toHaveLength(1);
      expect(db.adjustments[0]).toMatchObject({
        weekId: "week-5",
        paceDeviationTriggered: true,
        rpeTriggered: true,
        missedTriggered: false,
        decision: Decision.REDUCE,
        adjustmentPct: -20,
      });
      expect(result).toEqual(db.adjustments[0]);
      expect(db.weeks[0].reassessedAt).toBeInstanceOf(Date);
      // The reduce decision was applied to the following week's sessions.
      expect(week6Sessions()).toEqual(
        applyDecision(Decision.REDUCE, week6, { currentWeek: week5, vdot: VDOT }),
      );

      // A week with no signals records progress at 0% and leaves the next week as generated.
      const fresh6 = seed(fresh).week6;
      await reassessIfDue("week-5");
      expect(db.adjustments).toHaveLength(1);
      expect(db.adjustments[0]).toMatchObject({
        weekId: "week-5",
        paceDeviationTriggered: false,
        rpeTriggered: false,
        missedTriggered: false,
        decision: Decision.PROGRESS,
        adjustmentPct: 0,
      });
      expect(week6Sessions()).toEqual(fresh6);
    });

    it("reassessIfDue is a no-op when the week is already reassessed", async () => {
      seed(fatigued);
      await reassessIfDue("week-5");
      const adjustmentsAfterFirst = structuredClone(db.adjustments);
      const week6AfterFirst = week6Sessions();

      const second = await reassessIfDue("week-5");

      expect(second).toBeNull();
      expect(db.adjustments).toEqual(adjustmentsAfterFirst);
      expect(week6Sessions()).toEqual(week6AfterFirst);
    });

    it("reassessIfDue is a no-op when the unique constraint on weekId rejects a concurrent duplicate", async () => {
      seed(fatigued);
      await reassessIfDue("week-5");
      const adjustmentsAfterFirst = structuredClone(db.adjustments);
      const week6AfterFirst = week6Sessions();
      // A second tab read the week before the first committed: it still sees reassessedAt = null.
      db.weeks[0].reassessedAt = null;

      const second = await reassessIfDue("week-5");

      expect(second).toBeNull();
      expect(db.adjustments).toEqual(adjustmentsAfterFirst);
      // Week 6 was reduced once, not twice.
      expect(week6Sessions()).toEqual(week6AfterFirst);
    });
  });
});
