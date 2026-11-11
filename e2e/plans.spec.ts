import { PlanStatus, RaceType } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { getSeededUserId, login, resetPlans, seedActivePlan } from "./helpers";
import { formatLongDay } from "../lib/format";
import { prisma } from "../lib/prisma";

// The plans screen is a phone screen first (Passo Ritmo, 390px wide).
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await resetPlans(await getSeededUserId());
  await login(page);
});

test("the plans screen lists each active and paused plan with race, date, weeks and status", async ({ page }) => {
  const userId = await getSeededUserId();
  // A 10K plan, then a half marathon that becomes the followed one and pauses the 10K.
  const { planId: tenK } = await seedActivePlan(userId, { raceInDays: 70 });
  const { planId: half } = await seedActivePlan(userId, { raceInDays: 120, raceType: RaceType.HALF });
  // An archived plan is history, not one of the plans on this screen.
  await prisma.plan.create({
    data: {
      userId,
      raceType: RaceType.MARATHON,
      raceDate: new Date("2026-01-01T00:00:00Z"),
      startDate: new Date("2025-09-01T00:00:00Z"),
      daysPerWeek: [1, 3, 6],
      initialVdot: 45,
      currentVdot: 45,
      status: PlanStatus.ARCHIVED,
    },
  });
  const plans = await prisma.plan.findMany({ where: { id: { in: [tenK, half] } }, include: { weeks: true } });
  const byId = Object.fromEntries(plans.map((p) => [p.id, p]));

  await page.goto("/plans");

  await expect(page.getByRole("heading", { level: 1, name: "Planos" })).toBeVisible();
  const items = page.getByRole("list", { name: "Seus planos" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  // The followed plan comes first.
  for (const [i, id, name, status] of [
    [0, half, "Meia maratona (21km)", "Seguindo"],
    [1, tenK, "10K (10km)", "Pausado"],
  ] as const) {
    const item = items.nth(i);
    await expect(item.getByRole("heading", { level: 2 })).toHaveText(name);
    await expect(item.getByText(status, { exact: true })).toBeVisible();
    await expect(item.getByRole("term")).toHaveText(["Data da prova", "Semanas"]);
    await expect(item.getByRole("definition")).toHaveText([
      formatLongDay(byId[id].raceDate),
      String(byId[id].weeks.length),
    ]);
  }
  await expect(page.getByText("Maratona (42km)")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Novo plano" })).toHaveAttribute("href", "/plan/new");
  // Nothing spills past the phone's width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("following a paused plan makes it active and pauses the other", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId: tenK } = await seedActivePlan(userId);
  const { planId: half } = await seedActivePlan(userId, { raceInDays: 120, raceType: RaceType.HALF });

  await page.goto("/plans");
  const items = page.getByRole("list", { name: "Seus planos" }).getByRole("listitem");
  // Only the paused plan offers to be followed.
  await expect(items.filter({ hasText: "Meia maratona" }).getByRole("button", { name: "Seguir este plano" })).toHaveCount(0);
  await items.filter({ hasText: "10K (10km)" }).getByRole("button", { name: "Seguir este plano" }).click();

  await expect(items.filter({ hasText: "10K (10km)" }).getByText("Seguindo", { exact: true })).toBeVisible();
  await expect(items.filter({ hasText: "Meia maratona" }).getByText("Pausado", { exact: true })).toBeVisible();
  const statuses = await prisma.plan.findMany({ where: { userId }, select: { id: true, status: true } });
  expect(Object.fromEntries(statuses.map((p) => [p.id, p.status]))).toEqual({
    [tenK]: PlanStatus.ACTIVE,
    [half]: PlanStatus.PAUSED,
  });
});

test("the dashboard shows the current week of the plan just followed", async ({ page }) => {
  const userId = await getSeededUserId();
  // The 10K started 10 days ago (its week 2 is current); the half marathon starts today.
  await seedActivePlan(userId, { daysAgo: 10 });
  await seedActivePlan(userId, { daysAgo: 0, raceInDays: 120, raceType: RaceType.HALF });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Semana 1");
  await expect(page.getByRole("region", { name: "Próxima prova" })).toContainText("Meia maratona");

  await page.goto("/plans");
  await page
    .getByRole("list", { name: "Seus planos" })
    .getByRole("listitem")
    .filter({ hasText: "10K (10km)" })
    .getByRole("button", { name: "Seguir este plano" })
    .click();
  await expect(page.getByRole("listitem").filter({ hasText: "10K (10km)" }).getByText("Seguindo")).toBeVisible();
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Semana 2");
  const race = page.getByRole("region", { name: "Próxima prova" });
  await expect(race.getByRole("heading", { level: 2 })).toHaveText("10K");
});

test("a fourth plan is refused with the 3-plan message", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  for (const raceInDays of [70, 90, 120]) await seedActivePlan(userId, { raceInDays });
  const before = await prisma.plan.findMany({ where: { userId }, orderBy: { id: "asc" } });

  await page.goto("/plan/new/vdot?mode=manual");
  await page.getByLabel("Distância (km)").fill("5");
  await page.getByLabel("Minutos").fill("19");
  await page.getByLabel("Segundos").fill("57");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/plan\/new\?/);
  await page.getByLabel(/5km/).check();
  await page.getByLabel("Data da prova").fill(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
  for (const day of ["Seg", "Qua", "Sáb"]) await page.getByRole("checkbox", { name: day }).check();
  await page.getByRole("button", { name: "Criar plano" }).click();

  await expect(page.locator("main").getByRole("alert")).toHaveText("Você já tem 3 planos. Exclua um para criar outro.");
  // Nothing was created and no plan changed status.
  expect(await prisma.plan.findMany({ where: { userId }, orderBy: { id: "asc" } })).toEqual(before);
});

