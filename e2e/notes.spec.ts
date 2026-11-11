import { expect, test, type Page } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await resetPlans(await getSeededUserId());
  await login(page);
});

async function firstSession(planId: string) {
  const week = await prisma.week.findFirstOrThrow({ where: { planId, weekNumber: 1 } });
  return prisma.session.findFirstOrThrow({ where: { weekId: week.id }, orderBy: { date: "asc" } });
}

async function logWithNote(page: Page, sessionId: string, note: string) {
  await page.goto(`/dashboard/log/${sessionId}`);
  await page.getByLabel("Distância (km)").fill("8");
  await page.getByLabel("Duração (min:seg)").fill("41");
  await page.getByRole("radio", { name: /^RPE 6:/ }).check();
  await page.getByLabel("Observação (opcional)").fill(note);
  await page.getByRole("button", { name: "Salvar registro" }).click();
}

test("a note typed when logging is saved to the log", async ({ page }) => {
  const { planId } = await seedActivePlan(await getSeededUserId(), { daysAgo: 3 });
  const session = await firstSession(planId);

  await logWithNote(page, session.id, "  Calor forte, segurei o ritmo.  ");

  await expect(page).toHaveURL(/\/dashboard$/);
  const log = await prisma.workoutLog.findUniqueOrThrow({ where: { sessionId: session.id } });
  expect(log.notes).toBe("Calor forte, segurei o ritmo.");
});

test("a note over 500 characters is refused with the spec message", async ({ page }) => {
  const { planId } = await seedActivePlan(await getSeededUserId(), { daysAgo: 3 });
  const session = await firstSession(planId);

  await logWithNote(page, session.id, "a".repeat(501));

  await expect(page.locator("main").getByRole("alert")).toHaveText("Observação inválida: no máximo 500 caracteres.");
  expect(await prisma.workoutLog.count({ where: { sessionId: session.id } })).toBe(0);
});

test("editing a log shows its saved note in the field", async ({ page }) => {
  const { planId } = await seedActivePlan(await getSeededUserId(), { daysAgo: 3 });
  const session = await firstSession(planId);
  await logWorkout(session.id);
  await prisma.workoutLog.update({ where: { sessionId: session.id }, data: { notes: "Dor leve na panturrilha." } });

  await page.goto(`/dashboard/log/${session.id}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Editar registro");
  await expect(page.getByLabel("Observação (opcional)")).toHaveValue("Dor leve na panturrilha.");
});

test("the dashboard card shows the note of a logged session", async ({ page }) => {
  const { planId } = await seedActivePlan(await getSeededUserId(), { daysAgo: 3 });
  const session = await firstSession(planId);
  await logWorkout(session.id);
  await prisma.workoutLog.update({ where: { sessionId: session.id }, data: { notes: "Treino na esteira." } });

  await page.goto("/dashboard");

  const card = page.getByRole("listitem").filter({ has: page.locator(`a[href="/dashboard/log/${session.id}"]`) });
  await expect(card).toContainText("Treino na esteira.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
