"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSeededUserId } from "@/lib/domain/auth";
import { deleteSession } from "@/lib/domain/plan-lifecycle";
import { deleteWorkoutLog, saveWorkoutLog } from "@/lib/domain/workout-log";

// Spec LOG-02 bounds. Each field's message names the field, so the form can say which one is
// invalid. Pace is typed as mm:ss (per km) and must come out positive.
const PACE_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

const logSchema = z.object({
  pace: z
    .string()
    .trim()
    .regex(PACE_PATTERN, "Pace inválido: use o formato mm:ss por km (ex.: 5:30).")
    .transform((text) => {
      const [, minutes, seconds] = PACE_PATTERN.exec(text)!;
      return Number(minutes) * 60 + Number(seconds);
    })
    .refine((secPerKm) => secPerKm > 0, "Pace inválido: precisa ser maior que 0:00."),
  distanceKm: z.coerce
    .number({ invalid_type_error: "Distância inválida: informe um número em km." })
    .gt(0, "Distância inválida: precisa ser maior que 0 km.")
    .lte(200, "Distância inválida: no máximo 200 km."),
  durationMin: z.coerce
    .number({ invalid_type_error: "Duração inválida: informe os minutos." })
    .int("Duração inválida: informe minutos inteiros.")
    .gt(0, "Duração inválida: precisa ser maior que 0 minutos.")
    .lte(600, "Duração inválida: no máximo 600 minutos."),
  rpe: z.coerce
    .number({ invalid_type_error: "RPE inválido: informe um inteiro de 1 a 10." })
    .int("RPE inválido: informe um inteiro de 1 a 10.")
    .min(1, "RPE inválido: informe um inteiro de 1 a 10.")
    .max(10, "RPE inválido: informe um inteiro de 1 a 10."),
});

// An empty field must fail its own rule instead of coercing to 0 or passing as "".
function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function submitWorkoutLog(sessionId: string, formData: FormData): Promise<void> {
  const parsed = logSchema.safeParse({
    pace: field(formData, "pace") ?? "",
    distanceKm: field(formData, "distanceKm"),
    durationMin: field(formData, "durationMin"),
    rpe: field(formData, "rpe"),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Registro inválido.";
    redirect(`/dashboard/log/${sessionId}?error=${encodeURIComponent(message)}`);
  }

  // Spec NOTE-01..03: the note goes as typed; saveWorkoutLog trims it and refuses one over 500.
  const notes = z.string().nullable().catch(null).parse(formData.get("notes"));
  try {
    await saveWorkoutLog(sessionId, {
      actualPaceSecPerKm: parsed.data.pace,
      actualDistanceKm: parsed.data.distanceKm,
      actualDurationMin: parsed.data.durationMin,
      rpe: parsed.data.rpe,
      notes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o registro.";
    redirect(`/dashboard/log/${sessionId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Spec LOG-04/05: delete the session's log, whatever its week's reassessment state.
export async function removeWorkoutLog(sessionId: string): Promise<void> {
  await deleteWorkoutLog(sessionId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Spec DEL-08/10: delete the session, with its log, from the followed plan; the domain refuses the
// week's last session and any session that is not the user's followed plan's.
export async function deleteSessionAction(sessionId: string): Promise<void> {
  try {
    await deleteSession(await getSeededUserId(), sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir o treino.";
    redirect(`/dashboard/log/${sessionId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
