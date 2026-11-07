"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isPlausibleResult } from "@/lib/domain/vdot";

export type VdotMode = "guided" | "manual";

const resultSchema = z
  .object({
    distanceKm: z.coerce.number().positive(),
    minutes: z.coerce.number().int().min(0),
    seconds: z.coerce.number().int().min(0).max(59),
  })
  .superRefine((data, ctx) => {
    const timeSec = data.minutes * 60 + data.seconds;
    if (!isPlausibleResult(data.distanceKm, timeSec)) {
      ctx.addIssue({
        code: "custom",
        path: ["minutes"],
        message: "Esse tempo não é fisicamente possível para essa distância.",
      });
    }
  });

// Spec VDOT-01/02/03: the guided-test and manual-entry forms both submit a distance/time result
// here. A valid result carries the established VDOT source forward to /plan/new, which creates
// the plan (T27) — nothing is persisted yet, since no Plan exists until the race form is filled.
export async function submitVdotResult(mode: VdotMode, formData: FormData): Promise<void> {
  const parsed = resultSchema.safeParse({
    distanceKm: formData.get("distanceKm"),
    minutes: formData.get("minutes"),
    seconds: formData.get("seconds"),
  });

  const backParams = new URLSearchParams({ mode });
  if (mode === "guided") backParams.set("step", "result");

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    backParams.set("error", issue.message);
    backParams.set("field", String(issue.path[0]));
    redirect(`/plan/new/vdot?${backParams.toString()}`);
  }

  const { distanceKm, minutes, seconds } = parsed.data;
  const timeSec = minutes * 60 + seconds;
  const source = mode === "guided" ? "TEST" : "MANUAL";
  const forward = new URLSearchParams({
    distanceKm: String(distanceKm),
    timeSec: String(timeSec),
    source,
  });
  redirect(`/plan/new?${forward.toString()}`);
}
