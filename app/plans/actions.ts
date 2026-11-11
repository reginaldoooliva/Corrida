"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { appToday } from "@/lib/domain/clock";
import { getSeededUserId } from "@/lib/domain/auth";
import { followPlan } from "@/lib/domain/plan-lifecycle";

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
