import { PlanStatus, VdotSource } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { getSeededUserId, login, resetPlans, seedActivePlan } from "./helpers";
import { recordRaceResult } from "../lib/domain/plan-lifecycle";
import { calculateVdot } from "../lib/domain/vdot";
import { prisma } from "../lib/prisma";

test.beforeEach(async ({ page }) => {
  const userId = await getSeededUserId();
  await resetPlans(userId);
  await login(page);
});

const DAY_MS = 86400000;

// Moves an active plan's race to yesterday, so the next dashboard load archives it (LIFE-01).
async function raceWasYesterday(planId: string): Promise<void> {
  await prisma.plan.update({ where: { id: planId }, data: { raceDate: new Date(Date.now() - DAY_MS) } });
}

const prompt = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Aviso de resultado de prova" });

test("an archived plan with no race result shows a prompt asking for the finish time", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);

  // Race still ahead: no prompt.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Semana/ })).toBeVisible();
  await expect(prompt(page)).toHaveCount(0);

  // Race date passed: the plan is archived on load and the prompt asks for the finish time.
  await raceWasYesterday(planId);
  await page.goto("/dashboard");
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).toContainText("tempo final");
  expect((await prisma.plan.findUniqueOrThrow({ where: { id: planId } })).status).toBe(PlanStatus.ARCHIVED);

  // Archived with a result already recorded: no prompt.
  await recordRaceResult(planId, 40 * 60);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Criar um novo plano" })).toBeVisible();
  await expect(prompt(page)).toHaveCount(0);
});

test("submitting a finish time saves the result and hides the prompt", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  await raceWasYesterday(planId);

  await page.goto("/dashboard");
  await prompt(page).getByLabel("Horas").fill("0");
  await prompt(page).getByLabel("Minutos").fill("41");
  await prompt(page).getByLabel("Segundos").fill("21");
  await prompt(page).getByRole("button", { name: "Salvar resultado" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Criar um novo plano" })).toBeVisible();

  const finishTimeSec = 41 * 60 + 21;
  const vdot = calculateVdot(10, finishTimeSec); // the seeded plan is a 10km
  expect(await prisma.raceResult.findUniqueOrThrow({ where: { planId } })).toMatchObject({
    finishTimeSec,
    vdotComputed: vdot,
  });
  expect(
    await prisma.vdotHistory.count({ where: { planId, source: VdotSource.RACE, vdot } }),
  ).toBe(1);
});
