import { describe, expect, it } from "vitest";

import {
  DURATION_FORMAT_ERROR,
  DURATION_MAX_ERROR,
  DURATION_ZERO_ERROR,
  formatDuration,
  paceFromRun,
  parseDuration,
} from "./pace";

describe("pace", () => {
  it("parseDuration reads minutes and seconds with :, comma or dot, minutes alone, and hours", () => {
    for (const raw of ["42:28", "42,28", "42.28", " 42:28 "]) expect(parseDuration(raw), raw).toBe(42 * 60 + 28);
    expect(parseDuration("42")).toBe(42 * 60);
    expect(parseDuration("0:01")).toBe(1);
    expect(parseDuration("105:00")).toBe(105 * 60);
    expect(parseDuration("1:02:28")).toBe(3600 + 2 * 60 + 28);
  });

  it("parseDuration refuses what is not minutes and seconds 00-59", () => {
    for (const raw of ["", "abc", "42:5", "42,5", "42:60", "42:285", "42;28", "-42", "1:60:00", "42:28:"]) {
      expect(() => parseDuration(raw), raw).toThrow(DURATION_FORMAT_ERROR);
    }
  });

  it("parseDuration refuses a zero duration and one over 600 minutes, at the boundary", () => {
    for (const raw of ["0", "0:00", "0:00:00"]) expect(() => parseDuration(raw), raw).toThrow(DURATION_ZERO_ERROR);
    expect(parseDuration("600")).toBe(36000);
    expect(parseDuration("10:00:00")).toBe(36000);
    for (const raw of ["600:01", "601", "10:00:01"]) expect(() => parseDuration(raw), raw).toThrow(DURATION_MAX_ERROR);
  });

  it("formatDuration shows seconds as the form takes them back", () => {
    expect(formatDuration(42 * 60 + 28)).toBe("42:28");
    expect(formatDuration(25 * 60)).toBe("25:00");
    expect(formatDuration(3600 + 2 * 60 + 8)).toBe("1:02:08");
    for (const sec of [1, 2548, 3600, 36000]) expect(parseDuration(formatDuration(sec))).toBe(sec);
  });

  it("paceFromRun is the duration over the distance, rounded to the second per km", () => {
    expect(paceFromRun(5, 25 * 60)).toBe(300); // 5:00/km
    expect(paceFromRun(7.59, 42 * 60 + 28)).toBe(336); // 335.7s - 5:36/km
    expect(paceFromRun(8, 41 * 60)).toBe(308); // 307.5s
    expect(paceFromRun(21.0975, 105 * 60)).toBe(299); // 298.6s
  });

  it("paceFromRun is null until both distance and duration are positive numbers", () => {
    for (const [km, sec] of [[0, 1800], [5, 0], [-5, 1800], [5, -1], [Number.NaN, 1800], [5, Number.NaN]]) {
      expect(paceFromRun(km, sec), `${km} km, ${sec} s`).toBeNull();
    }
  });
});
