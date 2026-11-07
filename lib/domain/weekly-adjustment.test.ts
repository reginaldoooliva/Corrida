import { describe, expect, it } from "vitest";

import { computeSignals } from "./weekly-adjustment";

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
});
