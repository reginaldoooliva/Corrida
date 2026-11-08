import { expect, test, type Page } from "@playwright/test";

import { getSeededUserId, login, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";

test.beforeEach(async ({ page }) => {
  const userId = await getSeededUserId();
  await resetPlans(userId);
  await login(page);
});

const VALID = { pace: "5:10", distanceKm: "8", durationMin: "41", rpe: "6" };

async function firstUnloggedSession(planId: string) {
  const week = await prisma.week.findFirstOrThrow({ where: { planId }, orderBy: { weekNumber: "asc" } });
  return prisma.session.findFirstOrThrow({
    where: { weekId: week.id, workoutLog: null },
    orderBy: { date: "asc" },
  });
}

async function fillLogForm(page: Page, values: typeof VALID) {
  await page.getByLabel("Pace (mm:ss por km)").fill(values.pace);
  await page.getByLabel("Distância (km)").fill(values.distanceKm);
  await page.getByLabel("Duração (min)").fill(values.durationMin);
  await page.getByLabel("RPE (1 a 10)").fill(values.rpe);
  await page.getByRole("button", { name: "Salvar registro" }).click();
}

test("submitting a valid workout log marks the session done", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  const session = await firstUnloggedSession(planId);
  const date = session.date.toISOString().slice(0, 10);

  await page.goto("/dashboard");
  const row = page.getByRole("listitem").filter({ hasText: date });
  await row.getByRole("link", { name: "Registrar treino" }).click();
  await expect(page.getByRole("heading", { name: "Registrar treino" })).toBeVisible();
  await fillLogForm(page, VALID);

  await expect(page).toHaveURL(/\/dashboard$/);
  const updatedRow = page.getByRole("listitem").filter({ hasText: date });
  await expect(updatedRow).toContainText("Feito");
  await expect(updatedRow).toContainText("Pace real: 5:10/km");
  const log = await prisma.workoutLog.findUniqueOrThrow({ where: { sessionId: session.id } });
  expect(log).toMatchObject({ actualPaceSecPerKm: 310, actualDistanceKm: 8, actualDurationMin: 41, rpe: 6 });
});

test("an out-of-range field is rejected and named in the error", async ({ page }) => {
  test.setTimeout(180000);
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  const session = await firstUnloggedSession(planId);

  // One case per LOG-02 bound; each names the field it breaks.
  const cases: { values: typeof VALID; field: string }[] = [
    { values: { ...VALID, distanceKm: "200.5" }, field: "Distância" },
    { values: { ...VALID, distanceKm: "0" }, field: "Distância" },
    { values: { ...VALID, durationMin: "601" }, field: "Duração" },
    { values: { ...VALID, durationMin: "0" }, field: "Duração" },
    { values: { ...VALID, pace: "abc" }, field: "Pace" },
    { values: { ...VALID, pace: "0:00" }, field: "Pace" },
    { values: { ...VALID, rpe: "11" }, field: "RPE" },
    { values: { ...VALID, rpe: "0" }, field: "RPE" },
    { values: { ...VALID, rpe: "5.5" }, field: "RPE" },
  ];

  for (const { values, field } of cases) {
    await page.goto(`/dashboard/log/${session.id}`);
    await fillLogForm(page, values);
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert, JSON.stringify(values)).toContainText(`${field} inválid`);
    for (const other of ["Distância", "Duração", "Pace", "RPE"].filter((f) => f !== field)) {
      await expect(alert, JSON.stringify(values)).not.toContainText(other);
    }
  }

  expect(await prisma.workoutLog.count({ where: { sessionId: session.id } })).toBe(0);
});
