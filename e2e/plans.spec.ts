import { PlanStatus, RaceType } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { backdateLatestVdot, getSeededUserId, login, resetPlans, seedActivePlan } from "./helpers";
import { appToday } from "../lib/domain/clock";
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

test("the dashboard never reassesses or prompts a retest for a paused plan", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  // The 10K's week 1 has ended and its VDOT is 30 days old: due for both, were it followed.
  const { planId: paused } = await seedActivePlan(userId, { daysAgo: 10 });
  await backdateLatestVdot(paused, 30);
  await seedActivePlan(userId, { daysAgo: 0, raceInDays: 120, raceType: RaceType.HALF });

  await page.goto("/dashboard");

  await expect(page.getByRole("region", { name: "Próxima prova" })).toContainText("Meia maratona");
  await expect(page.getByRole("region", { name: "Aviso de reteste de VDOT" })).toHaveCount(0);
  const weeks = await prisma.week.findMany({ where: { planId: paused }, include: { weeklyAdjustment: true } });
  expect(weeks.every((w) => w.reassessedAt === null && w.weeklyAdjustment === null)).toBe(true);
  expect((await prisma.plan.findUniqueOrThrow({ where: { id: paused } })).status).toBe(PlanStatus.PAUSED);
});

test("opening the plans screen or the dashboard archives a paused plan whose race has passed", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const { planId: first } = await seedActivePlan(userId, { raceInDays: 70 });
  const { planId: second } = await seedActivePlan(userId, { raceInDays: 90 });
  await seedActivePlan(userId, { raceInDays: 120, raceType: RaceType.HALF });
  const yesterday = new Date(appToday().getTime() - 86400000);
  const statusOf = async (id: string) => (await prisma.plan.findUniqueOrThrow({ where: { id } })).status;

  // The plans screen archives a paused plan whose race was yesterday, and stops listing it.
  await prisma.plan.update({ where: { id: first }, data: { raceDate: yesterday } });
  await page.goto("/plans");
  await expect(page.getByRole("list", { name: "Seus planos" }).getByRole("listitem")).toHaveCount(2);
  expect(await statusOf(first)).toBe(PlanStatus.ARCHIVED);
  expect(await statusOf(second)).toBe(PlanStatus.PAUSED);

  // So does the dashboard.
  await prisma.plan.update({ where: { id: second }, data: { raceDate: yesterday } });
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Próxima prova" })).toContainText("Meia maratona");
  expect(await statusOf(second)).toBe(PlanStatus.ARCHIVED);
});

test("with only paused plans the dashboard shows the empty state linking to the plans screen", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  await prisma.plan.update({ where: { id: planId }, data: { status: PlanStatus.PAUSED } });

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nenhum plano ativo");
  await expect(page.getByRole("link", { name: "Ver meus planos" })).toHaveAttribute("href", "/plans");
  await expect(page.getByRole("link", { name: "Criar um novo plano" })).toHaveAttribute("href", "/plan/new");
});

test("settings links to the plans screen", async ({ page }) => {
  // Without a followed plan...
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: /^Planos/ })).toHaveAttribute("href", "/plans");

  // ...and with one.
  await seedActivePlan(await getSeededUserId());
  await page.goto("/settings");
  await expect(page.getByRole("region", { name: "Plano ativo" })).toBeVisible();
  await page.getByRole("link", { name: /^Planos/ }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole("heading", { level: 1, name: "Planos" })).toBeVisible();
});

test("with three plans the history fits a phone screen and its plan tabs scroll", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId: archived } = await seedActivePlan(userId, { raceType: RaceType.FIVE_K });
  await prisma.plan.update({ where: { id: archived }, data: { status: PlanStatus.ARCHIVED } });
  await seedActivePlan(userId, { raceType: RaceType.HALF, raceInDays: 120 });
  await seedActivePlan(userId, { raceInDays: 70 });

  await page.goto("/history");
  const tabs = page.getByRole("navigation").filter({ has: page.locator(".plan-tabs") });
  await expect(page.locator(".plan-tabs a")).toHaveCount(3);

  const width = page.viewportSize()!.width;
  const past = await page.evaluate(
    (w) =>
      Array.from(document.querySelectorAll("main *"))
        .filter((el) => !el.closest(".plan-tabs li"))
        .filter((el) => el.getBoundingClientRect().right > w + 1)
        .map((el) => `${el.tagName} ${Math.round(el.getBoundingClientRect().right)}`),
    width,
  );
  expect(past, "elements past the right edge of the phone screen").toEqual([]);

  // The tabs that do not fit are reached by scrolling the tabs row itself.
  const last = page.locator(".plan-tabs a").last();
  await last.scrollIntoViewIfNeeded();
  const box = (await last.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  await expect(tabs).toBeVisible();
});
