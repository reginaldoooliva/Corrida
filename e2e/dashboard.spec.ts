import { expect, test } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";

test.beforeEach(async ({ page }) => {
  const userId = await getSeededUserId();
  await resetPlans(userId);
  await login(page);
});

test("shows the current week's sessions in date order with type, pace and distance", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  const week = await prisma.week.findFirstOrThrow({ where: { planId }, orderBy: { weekNumber: "asc" } });
  const sessions = await prisma.session.findMany({ where: { weekId: week.id }, orderBy: { date: "asc" } });

  await page.goto("/dashboard");

  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(sessions.length);
  for (const [i, session] of sessions.entries()) {
    const row = rows.nth(i);
    await expect(row).toContainText(session.date.toISOString().slice(0, 10));
    await expect(row).toContainText(String(session.plannedDistanceKm));
  }
});

test("a past session with no log shows as missed", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId, { daysAgo: 3 });
  const today = new Date();
  const week = await prisma.week.findFirstOrThrow({ where: { planId }, orderBy: { weekNumber: "asc" } });
  const pastSession = await prisma.session.findFirstOrThrow({
    where: { weekId: week.id, date: { lt: new Date(today.toISOString().slice(0, 10)) } },
  });

  await page.goto("/dashboard");

  const row = page.getByRole("listitem").filter({ hasText: pastSession.date.toISOString().slice(0, 10) });
  await expect(row).toContainText("Perdida");
});

test("a logged session shows as done with the actual pace next to the planned pace", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId, { daysAgo: 3 });
  const today = new Date();
  const week = await prisma.week.findFirstOrThrow({ where: { planId }, orderBy: { weekNumber: "asc" } });
  const pastSession = await prisma.session.findFirstOrThrow({
    where: { weekId: week.id, date: { lt: new Date(today.toISOString().slice(0, 10)) } },
  });
  await logWorkout(pastSession.id, { actualPaceSecPerKm: 280 });

  await page.goto("/dashboard");

  const row = page.getByRole("listitem").filter({ hasText: pastSession.date.toISOString().slice(0, 10) });
  await expect(row).toContainText("Feito");
  await expect(row).toContainText("4:40/km"); // actual pace: 280s = 4:40/km
  await expect(row).not.toContainText("Perdida");
});
