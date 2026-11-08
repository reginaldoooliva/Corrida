"use server";

import { RaceType, VdotSource } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSeededUserId } from "@/lib/domain/auth";
import type { Weekday } from "@/lib/domain/plan-generator";
import { ActivePlanExistsError, createNewPlan, createPlanFromCarryOver } from "@/lib/domain/plan-lifecycle";

export interface EstablishedVdot {
  distanceKm: number;
  timeSec: number;
  source: "TEST" | "MANUAL";
}

const inputSchema = z.object({
  raceType: z.nativeEnum(RaceType),
  raceDate: z.coerce.date(),
  days: z.array(z.coerce.number().int().min(0).max(6)),
});

function backToForm(vdotResult: EstablishedVdot, error: string): never {
  const params = new URLSearchParams({
    distanceKm: String(vdotResult.distanceKm),
    timeSec: String(vdotResult.timeSec),
    source: vdotResult.source,
    error,
  });
  redirect(`/plan/new?${params.toString()}`);
}

// Spec PLAN-01..04: creates the plan from the race config plus the VDOT result T26 established.
// Nothing was persisted until now; createNewPlan (T22) is the single write, guarded by LIFE-06.
export async function createPlanAction(
  vdotResult: EstablishedVdot,
  formData: FormData,
): Promise<void> {
  const parsed = inputSchema.safeParse({
    raceType: formData.get("raceType"),
    raceDate: formData.get("raceDate"),
    days: formData.getAll("days"),
  });

  if (!parsed.success) {
    backToForm(vdotResult, "Preencha o tipo de prova, a data e os dias de treino.");
  }

  const userId = await getSeededUserId();

  let createdPlanId: string;
  try {
    const { plan } = await createNewPlan({
      userId,
      raceType: parsed.data.raceType,
      raceDate: parsed.data.raceDate,
      daysPerWeek: parsed.data.days as Weekday[],
      vdotSource: vdotResult.source === "TEST" ? VdotSource.TEST : VdotSource.MANUAL,
      result: { distanceKm: vdotResult.distanceKm, timeSec: vdotResult.timeSec },
      today: new Date(),
    });
    createdPlanId = plan.id;
  } catch (error) {
    if (error instanceof ActivePlanExistsError) backToForm(vdotResult, error.message);
    backToForm(vdotResult, error instanceof Error ? error.message : "Não foi possível criar o plano.");
  }

  redirect(`/plan/new?created=${createdPlanId}`);
}

const carryOverSchema = inputSchema.extend({ vdot: z.coerce.number() });

// Spec LIFE-04/05: a plan started after an archived one, from the carried-over VDOT the form
// pre-filled (or the value the user edited it to). createPlanFromCarryOver picks the source.
export async function createCarryOverPlanAction(formData: FormData): Promise<void> {
  const parsed = carryOverSchema.safeParse({
    raceType: formData.get("raceType"),
    raceDate: formData.get("raceDate"),
    days: formData.getAll("days"),
    vdot: formData.get("vdot"),
  });

  if (!parsed.success) {
    redirect(`/plan/new?error=${encodeURIComponent("Preencha o VDOT, o tipo de prova, a data e os dias de treino.")}`);
  }

  const userId = await getSeededUserId();

  let createdPlanId: string;
  try {
    const { plan } = await createPlanFromCarryOver({
      userId,
      raceType: parsed.data.raceType,
      raceDate: parsed.data.raceDate,
      daysPerWeek: parsed.data.days as Weekday[],
      vdot: parsed.data.vdot,
      today: new Date(),
    });
    createdPlanId = plan.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar o plano.";
    redirect(`/plan/new?error=${encodeURIComponent(message)}`);
  }

  redirect(`/plan/new?created=${createdPlanId}`);
}
