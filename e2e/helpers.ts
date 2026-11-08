import { RaceType, VdotSource } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { expect, type Page } from "@playwright/test";

import { createNewPlan } from "../lib/domain/plan-lifecycle";
import type { Weekday } from "../lib/domain/plan-generator";
import { prisma } from "../lib/prisma";

// The seeded account (prisma/seed.ts) comes from the same .env the app reads, same pattern as
// auth.spec.ts.
loadEnvConfig(process.cwd());
export const SEED_USERNAME = process.env.SEED_USERNAME!;
export const SEED_PASSWORD = process.env.SEED_PASSWORD!;

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(SEED_USERNAME);
  await page.getByLabel("Senha").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Client-side router.replace (next-auth v4's signIn has no server redirect): poll the URL
  // instead of waitForURL, which waits for a "load" event an SPA transition never fires.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export async function getSeededUserId(): Promise<string> {
  const user = await prisma.user.findFirstOrThrow({ where: { username: SEED_USERNAME } });
  return user.id;
}

// Each onboarding/dashboard/logging e2e test runs against the single seeded user and the DB-level
// LIFE-06 constraint allows at most one ACTIVE plan for it, so every test that creates or depends
// on a plan must start from a clean slate. Deletes children before parents to satisfy FKs.
export async function resetPlans(userId: string): Promise<void> {
  await prisma.workoutLog.deleteMany({ where: { session: { week: { plan: { userId } } } } });
  await prisma.weeklyAdjustment.deleteMany({ where: { week: { plan: { userId } } } });
  await prisma.session.deleteMany({ where: { week: { plan: { userId } } } });
  await prisma.week.deleteMany({ where: { plan: { userId } } });
  await prisma.raceResult.deleteMany({ where: { plan: { userId } } });
  await prisma.vdotHistory.deleteMany({ where: { plan: { userId } } });
  await prisma.plan.deleteMany({ where: { userId } });
}

// Dashboard/logging e2e tests need a session that already landed in the past relative to the
// real "today", which createNewPlan can't produce on its own (every session it generates sits on
// or after the "today" it's given). Backdating the plan's own "today" by `daysAgo` makes week 1
// start that many days ago, so some of its sessions fall before the real wall-clock today -
// mirrors the spec's own Independent Test ("avançar artificialmente a data").
export async function seedActivePlan(
  userId: string,
  opts: { daysAgo?: number; days?: Weekday[] } = {},
): Promise<{ planId: string }> {
  const today = new Date();
  const start = new Date(today.getTime() - (opts.daysAgo ?? 3) * 86400000);
  const raceDate = new Date(today.getTime() + 70 * 86400000);
  const { plan } = await createNewPlan({
    userId,
    raceType: RaceType.TEN_K,
    raceDate,
    daysPerWeek: opts.days ?? [0, 1, 2, 3, 4, 5],
    vdotSource: VdotSource.MANUAL,
    result: { distanceKm: 5, timeSec: 19 * 60 + 57 },
    today: start,
  });
  return { planId: plan.id };
}

// Backdates a plan's latest VdotHistory entry without touching the plan's own age, so VDOT-04/05
// tests ("VDOT is stale") don't also have to make the whole plan (and its reassessment chain) old.
export async function backdateLatestVdot(planId: string, daysAgo: number): Promise<void> {
  const entry = await prisma.vdotHistory.findFirstOrThrow({
    where: { planId },
    orderBy: { date: "desc" },
  });
  await prisma.vdotHistory.update({
    where: { id: entry.id },
    data: { date: new Date(Date.now() - daysAgo * 86400000) },
  });
}

export async function logWorkout(
  sessionId: string,
  overrides: Partial<{ actualPaceSecPerKm: number; actualDistanceKm: number; actualDurationMin: number; rpe: number }> = {},
): Promise<void> {
  await prisma.workoutLog.create({
    data: {
      sessionId,
      actualPaceSecPerKm: overrides.actualPaceSecPerKm ?? 300,
      actualDistanceKm: overrides.actualDistanceKm ?? 5,
      actualDurationMin: overrides.actualDurationMin ?? 25,
      rpe: overrides.rpe ?? 5,
    },
  });
}
