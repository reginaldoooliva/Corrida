import type { WorkoutLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const NOTES_MAX = 500;
export const NOTES_ERROR = "Observação inválida: no máximo 500 caracteres.";

// Characters as a person counts them: an emoji or an accented letter is one, whatever its UTF-16
// length or its Unicode composition.
const graphemes = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
function characterCount(text: string): number {
  let n = 0;
  for (const _ of graphemes.segment(text)) n++;
  return n;
}

// Spec NOTE-02/03: the note is trimmed (and stored in NFC); an empty or blank one is no note at all
// (null), and one over 500 characters is refused.
export function parseNotes(raw: string | null | undefined): string | null {
  const notes = (raw ?? "").trim().normalize("NFC");
  if (characterCount(notes) > NOTES_MAX) throw new Error(NOTES_ERROR);
  return notes === "" ? null : notes;
}

export interface WorkoutLogInput {
  actualPaceSecPerKm: number;
  actualDistanceKm: number;
  actualDurationSec: number;
  rpe: number;
  // Spec NOTE-01: the note as typed; parseNotes decides what is saved.
  notes?: string | null;
}

// Spec LOG-01 (and LOG-03 for an existing log): one WorkoutLog per session (unique sessionId), so
// saving is an upsert. The session's status is derived from the log's presence
// (session-status.ts), so nothing else needs writing for it to show as done.
export async function saveWorkoutLog(sessionId: string, input: WorkoutLogInput): Promise<WorkoutLog> {
  const data = { ...input, notes: parseNotes(input.notes) };
  return prisma.workoutLog.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
}

// Spec LOG-04: removing the log is all it takes - the session's status is derived (done while a
// log exists, otherwise missed once its date has passed, pending until then).
export async function deleteWorkoutLog(sessionId: string): Promise<void> {
  await prisma.workoutLog.deleteMany({ where: { sessionId } });
}
