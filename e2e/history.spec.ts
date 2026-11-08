import { PlanStatus, VdotSource } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";

test.beforeEach(async ({ page }) => {
  const userId = await getSeededUserId();
  await resetPlans(userId);
  await login(page);
});

const DAY_MS = 86400000;
const pointLabel = (date: Date, vdot: number) => `${date.toISOString().slice(0, 10)}: VDOT ${vdot.toFixed(1)}`;

test("shows a VDOT-over-time chart built from VdotHistory", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();

  // An archived plan's own entries must stay out of the current plan's chart.
  const { planId: oldPlanId } = await seedActivePlan(userId);
  await prisma.plan.update({ where: { id: oldPlanId }, data: { status: PlanStatus.ARCHIVED } });
  await prisma.vdotHistory.create({
    data: { planId: oldPlanId, date: new Date(Date.now() - 200 * DAY_MS), vdot: 38.4, source: VdotSource.RECALC },
  });

  const { planId } = await seedActivePlan(userId);
  await prisma.vdotHistory.createMany({
    data: [
      { planId, date: new Date(Date.now() - 60 * DAY_MS), vdot: 47.3, source: VdotSource.RECALC },
      { planId, date: new Date(Date.now() - 30 * DAY_MS), vdot: 48.6, source: VdotSource.RECALC },
    ],
  });
  const entries = await prisma.vdotHistory.findMany({ where: { planId }, orderBy: { date: "asc" } });
  expect(entries).toHaveLength(3);

  await page.goto("/history");

  const chart = page.getByRole("img", { name: "VDOT ao longo do tempo" });
  await expect(chart).toBeVisible();
  // One point per entry, oldest first, each labelled with that entry's own date and VDOT.
  await expect(chart.locator("circle")).toHaveCount(entries.length);
  await expect(chart.locator("circle > title")).toHaveText(entries.map((e) => pointLabel(e.date, e.vdot)));
  await expect(chart).not.toContainText("VDOT 38.4");
});

const pace = (secPerKm: number) => `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}/km`;

test("shows actual-vs-planned pace and weekly adherence", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  // Week 1 started 10 days ago and has ended; week 2 is under way: two weeks of data.
  const { planId } = await seedActivePlan(userId, { daysAgo: 10 });
  const [week1, week2] = await prisma.week.findMany({
    where: { planId, weekNumber: { in: [1, 2] } },
    orderBy: { weekNumber: "asc" },
    include: { sessions: { orderBy: { date: "asc" } } },
  });
  const logged = [
    { session: week1.sessions[0], actual: 295 },
    { session: week1.sessions[2], actual: 340 },
    { session: week2.sessions[0], actual: 312 },
  ];
  for (const { session, actual } of logged) await logWorkout(session.id, { actualPaceSecPerKm: actual });

  await page.goto("/history");

  // One actual and one planned point per logged session, each with that session's own values.
  const chart = page.getByRole("img", { name: "Pace real vs. planejado" });
  await expect(chart).toBeVisible();
  await expect(chart.locator("circle")).toHaveCount(logged.length * 2);
  for (const { session, actual } of logged) {
    const day = session.date.toISOString().slice(0, 10);
    await expect(chart.locator("title", { hasText: `${day} real: ${pace(actual)}` })).toHaveCount(1);
    await expect(
      chart.locator("title", { hasText: `${day} planejado: ${pace(session.plannedPaceSecPerKm)}` }),
    ).toHaveCount(1);
  }

  // Adherence = done / planned sessions, per week.
  const adherence = page.getByRole("list", { name: "Aderência semanal" });
  await expect(adherence.getByRole("listitem").filter({ hasText: "Semana 1:" })).toHaveText(
    `Semana 1: 2 de ${week1.sessions.length} sessões feitas`,
  );
  await expect(adherence.getByRole("listitem").filter({ hasText: "Semana 2:" })).toHaveText(
    `Semana 2: 1 de ${week2.sessions.length} sessões feitas`,
  );
});
