import { Decision, RaceType, VdotSource } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  backdateLatestVdot,
  getSeededUserId,
  login,
  logWorkout,
  resetPlans,
  seedActivePlan,
} from "./helpers";
import { createNewPlan } from "../lib/domain/plan-lifecycle";
import { prisma } from "../lib/prisma";
import { appToday } from "../lib/domain/clock";

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
  const today = appToday();
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
  const today = appToday();
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

test("opening the dashboard after a week ends reassesses before showing next week", async ({ page }) => {
  test.setTimeout(60000);
  // Week 1 spans [today-10, today-4], already ended; week 2 is the current one.
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId, { daysAgo: 10 });
  const week1 = await prisma.week.findFirstOrThrow({ where: { planId, weekNumber: 1 } });
  const week1Sessions = await prisma.session.findMany({ where: { weekId: week1.id }, orderBy: { date: "asc" } });

  // 2 logged with RPE 9 (rpe signal) + the rest unlogged (missed signal, well over 25%) -> reduce.
  for (const session of week1Sessions.slice(0, 2)) {
    await logWorkout(session.id, { rpe: 9 });
  }

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Semana 2" })).toBeVisible();
  const adjustment = await prisma.weeklyAdjustment.findUniqueOrThrow({ where: { weekId: week1.id } });
  expect(adjustment.decision).toBe(Decision.REDUCE);

  // Loading the dashboard again does not reassess week 1 a second time (relies on T17's ADJ-06).
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Semana 2" })).toBeVisible();
  expect(await prisma.weeklyAdjustment.count({ where: { weekId: week1.id } })).toBe(1);
});

test("after the last taper week ends before the race date, the dashboard shows that week's sessions again instead of an empty week", async ({
  page,
}) => {
  const userId = await getSeededUserId();
  const today = appToday();
  // A 1-week plan (entirely taper): created 10 days ago, race date is today - the single
  // generated week already ended 4 days ago, but the race hasn't happened yet (rounding leaves a
  // few leftover days between the last week's end and the actual race day).
  const start = new Date(today.getTime() - 10 * 86400000);
  const { plan } = await createNewPlan({
    userId,
    raceType: RaceType.TEN_K,
    raceDate: today,
    daysPerWeek: [0, 1, 2, 3, 4, 5],
    vdotSource: VdotSource.MANUAL,
    result: { distanceKm: 5, timeSec: 19 * 60 + 57 },
    today: start,
  });
  const weeks = await prisma.week.findMany({ where: { planId: plan.id } });
  expect(weeks).toHaveLength(1);
  const sessions = await prisma.session.findMany({ where: { weekId: weeks[0].id } });

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Semana 1" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(sessions.length);
});

test("shows a retest prompt when the VDOT is 4 or more weeks old", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  await backdateLatestVdot(planId, 30);

  await page.goto("/dashboard");

  await expect(page.getByRole("region", { name: "Aviso de reteste de VDOT" })).toBeVisible();
});

test("submitting a retest result updates the VDOT and future sessions' planned paces", async ({ page }) => {
  test.setTimeout(60000);
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  await backdateLatestVdot(planId, 30);
  const week = await prisma.week.findFirstOrThrow({ where: { planId }, orderBy: { weekNumber: "asc" } });
  const pendingBefore = await prisma.session.findFirstOrThrow({
    where: { weekId: week.id, workoutLog: null },
  });

  await page.goto("/dashboard");
  const prompt = page.getByRole("region", { name: "Aviso de reteste de VDOT" });
  await expect(prompt).toBeVisible();
  // A much faster 5km (16:30, VDOT ~60) than the plan's original (19:57, VDOT ~50).
  await prompt.getByLabel("Distância (km)").fill("5");
  await prompt.getByLabel("Minutos").fill("16");
  await prompt.getByLabel("Segundos").fill("30");
  await prompt.getByRole("button", { name: "Enviar resultado" }).click();

  await expect(page.getByRole("region", { name: "Aviso de reteste de VDOT" })).toHaveCount(0, {
    timeout: 15000,
  });
  const updatedPlan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  expect(updatedPlan.currentVdot).toBeGreaterThan(55);
  const pendingAfter = await prisma.session.findUniqueOrThrow({ where: { id: pendingBefore.id } });
  expect(pendingAfter.plannedPaceSecPerKm).toBeLessThan(pendingBefore.plannedPaceSecPerKm);
  const vdotHistory = await prisma.vdotHistory.findMany({ where: { planId }, orderBy: { date: "desc" } });
  expect(vdotHistory[0]).toMatchObject({ source: VdotSource.RECALC });
});

test("dismissing the retest prompt hides it today and shows it again on the next visit", async ({ page }) => {
  test.setTimeout(60000);
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  await backdateLatestVdot(planId, 30);

  await page.goto("/dashboard");
  const prompt = page.getByRole("region", { name: "Aviso de reteste de VDOT" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Agora não" }).click();

  // The post-action re-render queries the live DB several times (~4-5s here): wait longer than 5s.
  await expect(page.getByRole("region", { name: "Aviso de reteste de VDOT" })).toHaveCount(0, {
    timeout: 15000,
  });
  // A later visit on the same day still keeps it hidden.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Semana/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Aviso de reteste de VDOT" })).toHaveCount(0);

  // Simulate the next calendar day: the dismiss cookie only hides the prompt for the day it names.
  await page.context().addCookies([
    { name: "retest_dismissed", value: "2000-01-01", domain: "localhost", path: "/" },
  ]);
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Aviso de reteste de VDOT" })).toBeVisible();
});
