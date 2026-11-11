import { beforeEach, describe, expect, it, vi } from "vitest";

const { logs } = vi.hoisted(() => ({ logs: new Map<string, Record<string, unknown>>() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workoutLog: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { sessionId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const row = logs.has(where.sessionId) ? { ...logs.get(where.sessionId), ...update } : create;
        logs.set(where.sessionId, row);
        return row;
      },
    },
  },
}));

import { NOTES_ERROR, NOTES_MAX, parseNotes, saveWorkoutLog } from "./workout-log";

const RUN = { actualPaceSecPerKm: 330, actualDistanceKm: 8, actualDurationMin: 44, rpe: 5 };

describe("workout-log", () => {
  beforeEach(() => logs.clear());

  it("parseNotes turns an empty or blank note into null", () => {
    for (const raw of ["", "   ", "\n\t ", null, undefined]) expect(parseNotes(raw)).toBeNull();
  });

  it("parseNotes trims the note and accepts up to 500 characters", () => {
    expect(parseNotes("  joelho doeu no km 6 \n")).toBe("joelho doeu no km 6");
    const longest = "a".repeat(500);
    expect(NOTES_MAX).toBe(500);
    expect(parseNotes(longest)).toBe(longest);
    expect(parseNotes(`  ${longest}  `)).toBe(longest);
  });

  it("parseNotes refuses a note over 500 characters with the spec message", () => {
    expect(NOTES_ERROR).toBe("Observação inválida: no máximo 500 caracteres.");
    expect(() => parseNotes("a".repeat(501))).toThrow(NOTES_ERROR);
  });

  it("parseNotes counts characters, not UTF-16 units: emoji and decomposed accents count as one", () => {
    expect(parseNotes("🏃".repeat(500))).toBe("🏃".repeat(500));
    expect(() => parseNotes("🏃".repeat(501))).toThrow(NOTES_ERROR);
    const decomposed = "é"; // "é" written as "e" + combining acute accent
    expect(parseNotes(decomposed.repeat(500))).toBe("é".repeat(500));
    expect(() => parseNotes(decomposed.repeat(501))).toThrow(NOTES_ERROR);
  });

  it("saveWorkoutLog saves the note in WorkoutLog.notes, and a blank one as null", async () => {
    await saveWorkoutLog("s1", { ...RUN, notes: " calor forte " });
    expect(logs.get("s1")).toMatchObject({ ...RUN, notes: "calor forte" });

    await saveWorkoutLog("s1", { ...RUN, notes: "  " });
    expect(logs.get("s1")?.notes).toBeNull();
  });

  it("saveWorkoutLog refuses a note over 500 characters and saves nothing", async () => {
    await expect(saveWorkoutLog("s2", { ...RUN, notes: "a".repeat(501) })).rejects.toThrow(NOTES_ERROR);
    expect(logs.has("s2")).toBe(false);
  });
});
