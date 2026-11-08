"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { appToday } from "@/lib/domain/clock";
import { isPlausibleRaceTime, recordRaceResult } from "@/lib/domain/plan-lifecycle";
import { recordVdotRetest } from "@/lib/domain/vdot";
import { prisma } from "@/lib/prisma";

import { RETEST_DISMISS_COOKIE } from "./constants";

const resultSchema = z.object({
  distanceKm: z.coerce.number().positive(),
  minutes: z.coerce.number().int().min(0),
  seconds: z.coerce.number().int().min(0).max(59),
});

// Spec VDOT-06: a result submitted through the retest banner adds a RECALC VdotHistory entry,
// updates currentVdot and recomputes future planned paces, all inside recordVdotRetest.
export async function submitRetestResult(planId: string, formData: FormData): Promise<void> {
  const parsed = resultSchema.safeParse({
    distanceKm: formData.get("distanceKm"),
    minutes: formData.get("minutes"),
    seconds: formData.get("seconds"),
  });

  if (!parsed.success) {
    redirect("/dashboard?retestError=Preencha+a+distância+e+o+tempo+corretamente.");
  }

  const timeSec = parsed.data.minutes * 60 + parsed.data.seconds;
  try {
    await recordVdotRetest(planId, { distanceKm: parsed.data.distanceKm, timeSec }, appToday());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar o resultado.";
    redirect(`/dashboard?retestError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// Spec VDOT-07: dismissing hides the banner for the day only - a cookie dated today is the
// simplest state that resets itself the next calendar day, no extra table needed.
export async function dismissRetestPrompt(): Promise<void> {
  const today = appToday().toISOString().slice(0, 10);
  const jar = await cookies();
  jar.set(RETEST_DISMISS_COOKIE, today, { path: "/" });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

const finishTimeSchema = z.object({
  hours: z.coerce.number().int().min(0),
  minutes: z.coerce.number().int().min(0).max(59),
  seconds: z.coerce.number().int().min(0).max(59),
});

const RACE_RESULT_ERROR = "Informe um tempo final plausível para a distância da prova.";

// Spec LIFE-02/03: the finish time sent through the race-result prompt becomes the archived plan's
// RaceResult (and a race-sourced VdotHistory entry, inside recordRaceResult).
export async function submitRaceResult(planId: string, formData: FormData): Promise<void> {
  const parsed = finishTimeSchema.safeParse({
    hours: formData.get("hours"),
    minutes: formData.get("minutes"),
    seconds: formData.get("seconds"),
  });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const finishTimeSec = parsed.success
    ? parsed.data.hours * 3600 + parsed.data.minutes * 60 + parsed.data.seconds
    : 0;

  if (!parsed.success || !isPlausibleRaceTime(plan.raceType, finishTimeSec)) {
    redirect(`/dashboard?raceResultError=${encodeURIComponent(RACE_RESULT_ERROR)}`);
  }

  await recordRaceResult(planId, finishTimeSec);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
