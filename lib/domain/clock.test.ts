import { describe, expect, it } from "vitest";

import { todayInTimeZone } from "./clock";
import { deriveSessionStatus } from "./session-status";

describe("todayInTimeZone", () => {
  it("keeps the local calendar day after 21:00 in Brazil, when the UTC day has already turned", () => {
    // 2026-11-09T01:30Z is 22:30 on 2026-11-08 in São Paulo.
    expect(todayInTimeZone(new Date("2026-11-09T01:30:00Z"), "America/Sao_Paulo").toISOString()).toBe(
      "2026-11-08T00:00:00.000Z",
    );
  });

  it("turns to the next day at local midnight", () => {
    expect(todayInTimeZone(new Date("2026-11-09T03:00:00Z"), "America/Sao_Paulo").toISOString()).toBe(
      "2026-11-09T00:00:00.000Z",
    );
  });

  it("a session dated today stays pending late in the local evening", () => {
    const today = todayInTimeZone(new Date("2026-11-09T01:30:00Z"), "America/Sao_Paulo");
    expect(deriveSessionStatus({ date: new Date("2026-11-08T00:00:00Z") }, false, today)).toBe("PENDING");
  });
});
