import { SessionType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the weeks/sessions/logs tables. A transaction works on a staged copy that
// replaces `db` only when the callback resolves.
type Row = Record<string, unknown>;
type Store = { weeks: Row[]; sessions: Row[]; logs: Row[] };

const { db, modelsFor } = vi.hoisted(() => {
  const db: Store = { weeks: [], sessions: [], logs: [] };
  function modelsFor(store: Store) {
    return {
      week: {
        findMany: async ({ where }: { where: { planId: string } }) =>
          structuredClone(
            store.weeks
              .filter((w) => w.planId === where.planId)
              .map((w) => ({
                ...w,
                sessions: store.sessions
                  .filter((s) => s.weekId === w.id)
                  .map((s) => ({
                    ...s,
                    workoutLog: store.logs.find((l) => l.sessionId === s.id) ?? null,
                  })),
              })),
          ),
      },
      session: {
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
          const session = store.sessions.find((s) => s.id === where.id)!;
          Object.assign(session, data);
          return structuredClone(session);
        },
      },
    };
  }
  return { db, modelsFor };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => {
      const staged = structuredClone(db);
      const result = await fn(modelsFor(staged));
      Object.assign(db, staged);
      return result;
    },
  },
}));

import {
  calculateVdot,
  isPlausibleResult,
  isRetestDue,
  paceForVdot,
  recomputeFuturePaces,
} from "./vdot";

// Reference values from Jack Daniels' published VDOT table (Daniels' Running Formula).
const TOLERANCE = 0.1;

describe("vdot", () => {
  describe("calculateVdot", () => {
    it("matches the Daniels table for a 5km in 19:57 (VDOT 50)", () => {
      expect(Math.abs(calculateVdot(5, 19 * 60 + 57) - 50)).toBeLessThanOrEqual(
        TOLERANCE,
      );
    });

    it("matches the Daniels table for a 10km in 50:03 (VDOT 40)", () => {
      expect(
        Math.abs(calculateVdot(10, 50 * 60 + 3) - 40),
      ).toBeLessThanOrEqual(TOLERANCE);
    });

    it("matches the Daniels table for a half marathon in 1:31:35 (VDOT 50)", () => {
      expect(
        Math.abs(calculateVdot(21.0975, 3600 + 31 * 60 + 35) - 50),
      ).toBeLessThanOrEqual(TOLERANCE);
    });
  });

  describe("isPlausibleResult", () => {
    it("isPlausibleResult rejects a physically impossible time for the given distance", () => {
      expect(isPlausibleResult(5, 119)).toBe(false);
      expect(isPlausibleResult(5, 60)).toBe(false);
      expect(isPlausibleResult(5, 0)).toBe(false);
    });

    it("isPlausibleResult accepts a realistic 5km time", () => {
      expect(isPlausibleResult(5, 25 * 60)).toBe(true);
      expect(isPlausibleResult(5, 19 * 60 + 57)).toBe(true);
    });
  });

  describe("paceForVdot", () => {
    // Daniels' VDOT 50 training paces (sec/km): E 5:07, M 4:31, T 4:15, I 3:55 (1:34 per 400m).
    // Daniels runs Long at E pace; the task requires Long to be distinct, so it is bounded
    // inside the aerobic zone: faster than Easy, slower than marathon pace (271 s/km).
    const VDOT = 50;
    const PACE_TOLERANCE_SEC = 2;
    const pace = (type: SessionType) => paceForVdot(VDOT, type).secPerKm;

    it.each([
      { type: SessionType.EASY, expected: 307 },
      { type: SessionType.TEMPO, expected: 255 },
      { type: SessionType.INTERVAL, expected: 235 },
    ])(
      "paceForVdot returns the correct pace for each session type ($type)",
      ({ type, expected }) => {
        expect(Math.abs(pace(type) - expected)).toBeLessThanOrEqual(
          PACE_TOLERANCE_SEC,
        );
        // Ordering: Interval fastest -> Tempo -> Long -> Easy slowest.
        expect(pace(SessionType.INTERVAL)).toBeLessThan(pace(SessionType.TEMPO));
        expect(pace(SessionType.TEMPO)).toBeLessThan(pace(SessionType.LONG));
        expect(pace(SessionType.LONG)).toBeLessThan(pace(SessionType.EASY));
      },
    );

    it("paceForVdot returns the correct pace for each session type (LONG)", () => {
      const long = pace(SessionType.LONG);
      expect(long).toBeGreaterThan(271);
      expect(long).toBeLessThan(pace(SessionType.EASY));
      expect(long).toBeGreaterThan(pace(SessionType.TEMPO));
    });
  });

  describe("isRetestDue", () => {
    it("isRetestDue is true once the latest VdotHistory entry is 4 or more weeks old", () => {
      const last = new Date("2026-10-10T18:00:00Z");
      expect(isRetestDue(last, new Date("2026-11-06T23:00:00Z"))).toBe(false); // 3 weeks 6 days
      expect(isRetestDue(last, new Date("2026-11-07T06:00:00Z"))).toBe(true); // exactly 4 weeks
      expect(isRetestDue(last, new Date("2026-12-01T12:00:00Z"))).toBe(true);
      expect(isRetestDue(last, last)).toBe(false);
    });
  });

  describe("recomputeFuturePaces", () => {
    // Two weeks of a plan at VDOT 45; "today" is Wednesday 2026-11-11, inside week 2.
    // Week 1 is past; in week 2 the Monday session was done (logged), the rest are not.
    const TODAY = new Date("2026-11-11T12:00:00Z");
    const OLD_VDOT = 45;
    const NEW_VDOT = 50;

    function seed() {
      db.weeks = [];
      db.sessions = [];
      db.logs = [];
      const weeks = [
        { id: "w1", planId: "p1", weekNumber: 1, start: "2026-11-01", end: "2026-11-07" },
        { id: "w2", planId: "p1", weekNumber: 2, start: "2026-11-08", end: "2026-11-14" },
        { id: "w3", planId: "p1", weekNumber: 3, start: "2026-11-15", end: "2026-11-21" },
        { id: "x1", planId: "other", weekNumber: 2, start: "2026-11-08", end: "2026-11-14" },
      ];
      const types = [SessionType.EASY, SessionType.TEMPO, SessionType.INTERVAL, SessionType.LONG];
      for (const w of weeks) {
        db.weeks.push({
          id: w.id,
          planId: w.planId,
          weekNumber: w.weekNumber,
          startDate: new Date(`${w.start}T00:00:00Z`),
          endDate: new Date(`${w.end}T00:00:00Z`),
        });
        types.forEach((type, i) => {
          const date = new Date(new Date(`${w.start}T00:00:00Z`).getTime() + (i + 1) * 86400000);
          db.sessions.push({
            id: `${w.id}-s${i}`,
            weekId: w.id,
            type,
            date,
            plannedPaceSecPerKm: paceForVdot(OLD_VDOT, type).secPerKm,
          });
        });
      }
      db.logs.push({ id: "l1", sessionId: "w2-s0" }); // week 2 Monday: done
      db.logs.push({ id: "l2", sessionId: "w1-s1" }); // week 1: done
    }
    const session = (id: string) => db.sessions.find((s) => s.id === id)!;

    beforeEach(seed);

    it("recomputeFuturePaces updates the planned pace of every not-yet-done session in the current and future weeks", async () => {
      await recomputeFuturePaces("p1", NEW_VDOT, TODAY);

      for (const id of ["w2-s1", "w2-s2", "w2-s3", "w3-s0", "w3-s1", "w3-s2", "w3-s3"]) {
        const s = session(id);
        expect(s.plannedPaceSecPerKm).toBe(paceForVdot(NEW_VDOT, s.type as SessionType).secPerKm);
        expect(s.plannedPaceSecPerKm).not.toBe(paceForVdot(OLD_VDOT, s.type as SessionType).secPerKm);
      }
    });

    it("recomputeFuturePaces leaves done sessions, past weeks and other plans untouched", async () => {
      const untouched = ["w2-s0", "w1-s0", "w1-s1", "w1-s2", "w1-s3", "x1-s0", "x1-s1"];
      const before = structuredClone(untouched.map(session));

      await recomputeFuturePaces("p1", NEW_VDOT, TODAY);

      expect(untouched.map(session)).toEqual(before);
    });
  });
});
