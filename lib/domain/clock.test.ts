import { describe, expect, it } from "vitest";

import { appNow, daysUntil, todayInTimeZone } from "./clock";
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

describe("appNow", () => {
  it("uses APP_NOW for a local walk-through", () => {
    expect(appNow({ APP_NOW: "2027-01-18T12:00:00-03:00" }).toISOString()).toBe("2027-01-18T15:00:00.000Z");
  });

  it("ignores APP_NOW on Vercel, so production keeps the real clock", () => {
    const before = Date.now();
    const now = appNow({ APP_NOW: "2027-01-18T12:00:00-03:00", VERCEL: "1" }).getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it("ignores an unparsable APP_NOW", () => {
    expect(Number.isNaN(appNow({ APP_NOW: "amanhã" }).getTime())).toBe(false);
  });
});

describe("daysUntil", () => {
  it("counts whole calendar days to a race, 0 on race day and negative after", () => {
    const today = new Date("2026-11-10T00:00:00Z");
    expect(daysUntil(new Date("2026-12-18T00:00:00Z"), today)).toBe(38);
    expect(daysUntil(today, today)).toBe(0);
    expect(daysUntil(new Date("2026-11-09T00:00:00Z"), today)).toBe(-1);
  });
});
