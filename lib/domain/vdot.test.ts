import { describe, expect, it } from "vitest";

import { calculateVdot, isPlausibleResult } from "./vdot";

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
});
