"use server";

import { PlanStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSeededUserId } from "@/lib/domain/auth";
import type { Weekday } from "@/lib/domain/plan-generator";
import { recalculateFromCurrentWeek } from "@/lib/domain/plan-lifecycle";
import { prisma } from "@/lib/prisma";

const editSchema = z.object({
  raceDate: z.coerce.date(),
  days: z.array(z.coerce.number().int().min(0).max(6)),
});

function backWithError(message: string): never {
  redirect(`/settings?error=${encodeURIComponent(message)}`);
}

// Spec SET-02 / EDIT-01..03: a race-date or training-days change from settings goes through the
// same recalculation as plan editing (T23), and its validation errors are shown as they come.
// LIFE-01: only the ACTIVE plan is ever recalculated.
export async function updatePlanSettings(formData: FormData): Promise<void> {
  const parsed = editSchema.safeParse({
    raceDate: formData.get("raceDate"),
    days: formData.getAll("days"),
  });
  if (!parsed.success) backWithError("Preencha a data da prova e os dias de treino.");

  const userId = await getSeededUserId();
  const plan = await prisma.plan.findFirst({ where: { userId, status: PlanStatus.ACTIVE } });
  if (!plan) redirect("/settings");

  try {
    await recalculateFromCurrentWeek(
      plan.id,
      { raceDate: parsed.data.raceDate, days: parsed.data.days as Weekday[] },
      new Date(),
    );
  } catch (error) {
    backWithError(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings");
}
