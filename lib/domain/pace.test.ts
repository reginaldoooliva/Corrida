import { describe, expect, it } from "vitest";

import { paceFromRun } from "./pace";

describe("pace", () => {
  it("paceFromRun is the duration over the distance, in seconds per km", () => {
    expect(paceFromRun(5, 25)).toBe(300); // 5:00/km
    expect(paceFromRun(10, 52)).toBe(312); // 5:12/km
    expect(paceFromRun(21.0975, 105)).toBe(299); // 298.6s rounds to 4:59/km
  });

  it("paceFromRun rounds to the nearest second", () => {
    expect(paceFromRun(8, 41)).toBe(308); // 307.5s
    expect(paceFromRun(7, 37)).toBe(317); // 317.14s
    expect(paceFromRun(3, 17)).toBe(340); // 340s exactly
  });

  it("paceFromRun is null until both distance and duration are positive numbers", () => {
    for (const [km, min] of [[0, 30], [5, 0], [-5, 30], [5, -1], [Number.NaN, 30], [5, Number.NaN]]) {
      expect(paceFromRun(km, min), `${km} km, ${min} min`).toBeNull();
    }
  });
});
