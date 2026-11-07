import { SessionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { calculateVdot, isPlausibleResult, paceForVdot } from "./vdot";

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
});
