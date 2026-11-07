import { Decision, Phase, SessionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { generateSessions, type Weekday } from "./plan-generator";
import { paceForVdot } from "./vdot";
import { applyDecision, computeSignals, decide } from "./weekly-adjustment";

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
      // missed exactly 1 of 4 planned sessions (25%).
      const week = {
        sessions: [logged(280, 294, 7), logged(300, 315, 8), logged(320, 336, 9), unlogged(300)],
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

    it("decide returns progress and leaves the next week as originally generated", () => {
      const decision = decide({ paceDeviation: false, rpe: false, missed: false });
      expect(decision).toBe(Decision.PROGRESS);

      const progressed = applyDecision(decision, nextWeek(), { currentWeek, vdot: VDOT });
      expect(progressed).toEqual(nextWeek());
    });
  });
});
