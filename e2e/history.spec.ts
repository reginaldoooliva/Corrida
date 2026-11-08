import { PlanStatus, VdotSource } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { getSeededUserId, login, resetPlans, seedActivePlan } from "./helpers";
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
