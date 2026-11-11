"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appToday } from "@/lib/domain/clock";
import { getSeededUserId } from "@/lib/domain/auth";
import { deletePlan, followPlan } from "@/lib/domain/plan-lifecycle";

const planIdSchema = z.string().min(1);

function backWithError(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "Não foi possível concluir. Tente de novo.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

// Spec PLANS-06/07/09/10: follow a paused plan; the domain pauses the one followed until now and
// archives the plan instead if its race has passed.
export async function followPlanAction(formData: FormData): Promise<void> {
  const planId = planIdSchema.safeParse(formData.get("planId"));
  if (!planId.success) redirect("/plans");

  try {
    await followPlan(await getSeededUserId(), planId.data, appToday());
  } catch (error) {
    backWithError("/plans", error);
  }

  revalidatePath("/plans");
  revalidatePath("/dashboard");
  redirect("/plans");
}

// Back to the screen the deletion was asked from: the plans screen or History (DEL-05/06).
const fromSchema = z.enum(["/plans", "/history"]).catch("/plans");

// Spec DEL-02/04: delete the plan with everything it owns; no other plan changes status.
export async function deletePlanAction(formData: FormData): Promise<void> {
  const from = fromSchema.parse(formData.get("from"));
  const planId = planIdSchema.safeParse(formData.get("planId"));
  if (!planId.success) redirect(from);

  try {
    await deletePlan(await getSeededUserId(), planId.data);
  } catch (error) {
    backWithError(from, error);
  }

  revalidatePath("/plans");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  redirect(from);
}
