import { loadEnvConfig } from "@next/env";
import { expect, type Page } from "@playwright/test";

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
