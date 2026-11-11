import { PlanStatus, RaceType } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { reassessIfDue } from "../lib/domain/weekly-adjustment";
import { prisma } from "../lib/prisma";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await resetPlans(await getSeededUserId());
  await login(page);
});

// A plan owning a row of every kind: weeks, sessions, a log, a weekly adjustment, VDOT history and
// a race result.
async function seedPlanWithEverything(userId: string, opts: { raceType?: RaceType } = {}) {
  const { planId } = await seedActivePlan(userId, { daysAgo: 10, raceType: opts.raceType });
  const week1 = await prisma.week.findFirstOrThrow({ where: { planId, weekNumber: 1 }, include: { sessions: true } });
  await logWorkout(week1.sessions[0].id);
  await reassessIfDue(week1.id);
  await prisma.raceResult.create({ data: { planId, finishTimeSec: 41 * 60, vdotComputed: 50, date: new Date() } });
  return planId;
}

async function rowsOf(planId: string) {
  const [plans, weeks, sessions, logs, adjustments, vdotHistory, raceResults] = await Promise.all([
    prisma.plan.count({ where: { id: planId } }),
    prisma.week.count({ where: { planId } }),
    prisma.session.count({ where: { week: { planId } } }),
    prisma.workoutLog.count({ where: { session: { week: { planId } } } }),
    prisma.weeklyAdjustment.count({ where: { week: { planId } } }),
    prisma.vdotHistory.count({ where: { planId } }),
    prisma.raceResult.count({ where: { planId } }),
  ]);
  return { plans, weeks, sessions, logs, adjustments, vdotHistory, raceResults };
}

const planItem = (page: Page, name: string) =>
  page.getByRole("list", { name: "Seus planos" }).getByRole("listitem").filter({ hasText: name });

test("deleting a plan asks for confirmation with the spec text", async ({ page }) => {
  const userId = await getSeededUserId();
  await seedActivePlan(userId, { raceType: RaceType.HALF, raceInDays: 120 });

  await page.goto("/plans");
  await planItem(page, "Meia maratona").getByRole("button", { name: "Excluir plano" }).click();

  const dialog = page.getByRole("dialog", { name: "Excluir plano" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("paragraph")).toHaveText(
    "Excluir o plano de Meia maratona? Todas as semanas, treinos e registros dele serão apagados. Isso não pode ser desfeito.",
  );
  await expect(dialog.getByRole("button")).toHaveText(["Cancelar", "Excluir"]);
  // The dialog fits the phone's width.
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test("confirming deletes the plan and every row it owns", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const doomed = await seedPlanWithEverything(userId);
  const kept = await seedPlanWithEverything(userId, { raceType: RaceType.HALF });
  const keptBefore = await rowsOf(kept);
  expect(Object.values(await rowsOf(doomed)).every((n) => n > 0)).toBe(true);

  await page.goto("/plans");
  await planItem(page, "10K (10km)").getByRole("button", { name: "Excluir plano" }).click();
  await page.getByRole("dialog", { name: "Excluir plano" }).getByRole("button", { name: "Excluir" }).click();

  await expect(planItem(page, "10K (10km)")).toHaveCount(0);
  await expect(planItem(page, "Meia maratona")).toBeVisible();
  expect(await rowsOf(doomed)).toEqual({
    plans: 0, weeks: 0, sessions: 0, logs: 0, adjustments: 0, vdotHistory: 0, raceResults: 0,
  });
  expect(await rowsOf(kept)).toEqual(keptBefore);
  // The half marathon stays the followed plan.
  expect((await prisma.plan.findUniqueOrThrow({ where: { id: kept } })).status).toBe(PlanStatus.ACTIVE);
});

test("cancelling the plan deletion keeps the plan and everything in it", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const planId = await seedPlanWithEverything(userId);
  const before = await rowsOf(planId);

  await page.goto("/plans");
  await planItem(page, "10K (10km)").getByRole("button", { name: "Excluir plano" }).click();
  const dialog = page.getByRole("dialog", { name: "Excluir plano" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(planItem(page, "10K (10km)")).toBeVisible();
  expect(await rowsOf(planId)).toEqual(before);
});

test("every plan on the plans screen and every archived plan in history offers Excluir plano", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const archived: string[] = [];
  for (const raceType of [RaceType.FIVE_K, RaceType.MARATHON]) {
    const { planId } = await seedActivePlan(userId, { raceType, raceInDays: 120 });
    await prisma.plan.update({ where: { id: planId }, data: { status: PlanStatus.ARCHIVED } });
    archived.push(planId);
  }
  await seedActivePlan(userId);
  await seedActivePlan(userId, { raceType: RaceType.HALF, raceInDays: 120 });

  await page.goto("/plans");
  const items = page.getByRole("list", { name: "Seus planos" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  for (const item of await items.all()) {
    await expect(item.getByRole("button", { name: "Excluir plano" })).toBeVisible();
  }

  for (const planId of archived) {
    await page.goto(`/history?plan=${planId}`);
    await expect(page.getByRole("link", { name: /arquivado/ })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Excluir plano" })).toBeVisible();
  }
  // The tabs name each plan by status: the followed, the paused and the archived ones.
  await expect(page.getByRole("navigation", { name: "Planos" }).getByRole("link")).toHaveText([
    /\(atual\)/, /\(pausado\)/, /\(arquivado\)/, /\(arquivado\)/,
  ]);
});

test("a deleted archived plan is no longer listed in history", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const { planId: old } = await seedActivePlan(userId, { raceType: RaceType.FIVE_K });
  await prisma.plan.update({ where: { id: old }, data: { status: PlanStatus.ARCHIVED } });
  await seedActivePlan(userId);

  await page.goto(`/history?plan=${old}`);
  await page.getByRole("button", { name: "Excluir plano" }).click();
  const dialog = page.getByRole("dialog", { name: "Excluir plano" });
  await expect(dialog.getByRole("paragraph")).toHaveText(
    "Excluir o plano de 5K? Todas as semanas, treinos e registros dele serão apagados. Isso não pode ser desfeito.",
  );
  await dialog.getByRole("button", { name: "Excluir" }).click();

  await expect(page).toHaveURL(/\/history$/);
  const tabs = page.getByRole("navigation", { name: "Planos" }).getByRole("link");
  await expect(tabs).toHaveCount(1);
  await expect(tabs).toHaveText(/\(atual\)/);
  expect(await prisma.plan.count({ where: { id: old } })).toBe(0);
});

// The followed plan's current week, sessions in date order.
async function currentWeekSessions(planId: string) {
  const week = await prisma.week.findFirstOrThrow({ where: { planId, weekNumber: 1 } });
  return prisma.session.findMany({ where: { weekId: week.id }, orderBy: { date: "asc" } });
}

