import { describe, expect, it } from "vitest";

import { deriveSessionStatus } from "./session-status";

const TODAY = new Date("2026-11-07T15:30:00Z");
const at = (iso: string) => ({ date: new Date(iso) });

describe("session-status", () => {
  it("a future-dated WorkoutLog is accepted and the session is marked done", () => {
    expect(deriveSessionStatus(at("2026-11-10T00:00:00Z"), true, TODAY)).toBe("DONE");
    expect(deriveSessionStatus(at("2026-11-07T00:00:00Z"), true, TODAY)).toBe("DONE");
    expect(deriveSessionStatus(at("2026-11-01T00:00:00Z"), true, TODAY)).toBe("DONE");
  });

  it("a past session with no log is missed", () => {
    expect(deriveSessionStatus(at("2026-11-06T00:00:00Z"), false, TODAY)).toBe("MISSED");
    expect(deriveSessionStatus(at("2026-10-20T00:00:00Z"), false, TODAY)).toBe("MISSED");
  });

  it("a session today or in the future with no log is pending", () => {
    expect(deriveSessionStatus(at("2026-11-07T00:00:00Z"), false, TODAY)).toBe("PENDING");
    expect(deriveSessionStatus(at("2026-11-12T00:00:00Z"), false, TODAY)).toBe("PENDING");
  });
});
