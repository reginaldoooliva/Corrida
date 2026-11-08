import type { WorkoutLog } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface WorkoutLogInput {
  actualPaceSecPerKm: number;
  actualDistanceKm: number;
  actualDurationMin: number;
  rpe: number;
}

// Spec LOG-01 (and LOG-03 for an existing log): one WorkoutLog per session (unique sessionId), so
// saving is an upsert. The session's status is derived from the log's presence
// (session-status.ts), so nothing else needs writing for it to show as done.
export async function saveWorkoutLog(sessionId: string, input: WorkoutLogInput): Promise<WorkoutLog> {
  return prisma.workoutLog.upsert({
    where: { sessionId },
    create: { sessionId, ...input },
    update: input,
  });
}

// Spec LOG-04: removing the log is all it takes - the session's status is derived (done while a
// log exists, otherwise missed once its date has passed, pending until then).
export async function deleteWorkoutLog(sessionId: string): Promise<void> {
  await prisma.workoutLog.deleteMany({ where: { sessionId } });
}
