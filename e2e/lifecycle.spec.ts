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

const dateDaysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

async function fillRaceForm(page: import("@playwright/test").Page) {
  await page.getByLabel(/10km/).check();
  await page.getByLabel("Data da prova").fill(dateDaysFromNow(70));
  for (const day of ["Seg", "Qua", "Sáb"]) await page.getByRole("checkbox", { name: day }).check();
}

test("a new plan defaults its VDOT from the last race result and lets the user edit it before confirming", async ({
  page,
}) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const { planId: oldPlanId } = await seedActivePlan(userId);
  await raceWasYesterday(oldPlanId);
  // 10km in 45:00 (VDOT ~45), well apart from the plan's own ~50, so the default is visibly the race's.
  await recordRaceResult(oldPlanId, 45 * 60);
  await prisma.plan.update({ where: { id: oldPlanId }, data: { status: PlanStatus.ARCHIVED } });
  const { vdotComputed } = await prisma.raceResult.findUniqueOrThrow({ where: { planId: oldPlanId } });
  expect((await prisma.plan.findUniqueOrThrow({ where: { id: oldPlanId } })).currentVdot).not.toBeCloseTo(
    vdotComputed,
    1,
  );

  // No VDOT step: the race form opens with the race result's VDOT already filled in.
  await page.goto("/plan/new");
  await expect(page).toHaveURL(/\/plan\/new$/);
  const vdotField = page.getByLabel("VDOT inicial");
  await expect(vdotField).toHaveValue(vdotComputed.toFixed(1));

  // Editable before confirming: the plan starts from the edited value.
  await vdotField.fill("51.5");
  await fillRaceForm(page);
  await page.getByRole("button", { name: "Criar plano" }).click();

  await expect(page.getByRole("heading", { name: "Plano criado" })).toBeVisible({ timeout: 15000 });
  const plan = await prisma.plan.findFirstOrThrow({ where: { userId, status: PlanStatus.ACTIVE } });
  expect(plan).toMatchObject({ initialVdot: 51.5, currentVdot: 51.5 });
  expect(await prisma.vdotHistory.findMany({ where: { planId: plan.id } })).toMatchObject([
    { vdot: 51.5, source: VdotSource.MANUAL },
  ]);
});

test("attempting a second active plan shows the one-active-plan rejection", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  await seedActivePlan(userId);

  // The manual-entry route (T26/T27) still reaches the race form while a plan is active.
  await page.goto("/plan/new?distanceKm=5&timeSec=1197&source=MANUAL");
  await fillRaceForm(page);
  await page.getByRole("button", { name: "Criar plano" }).click();

  await expect(page.locator("main").getByRole("alert")).toContainText("You already have an active plan");
  await expect(page.getByRole("heading", { name: "Plano criado" })).toHaveCount(0);
  expect(await prisma.plan.count({ where: { userId, status: PlanStatus.ACTIVE } })).toBe(1);
});
