import { expect, test, type Page } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";
import { appToday } from "../lib/domain/clock";
import { formatSessionDay } from "../lib/format";

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

// RPE is picked from ten runners (radios named "RPE n: ..."). A value the picker cannot offer is
// posted by rewriting one radio's value, as a tampered request would, so the Server Action's
// LOG-02 bound is still exercised.
async function pickRpe(page: Page, rpe: string) {
  if (/^([1-9]|10)$/.test(rpe)) {
    await page.getByRole("radio", { name: new RegExp(`^RPE ${rpe}:`) }).check();
    return;
  }
  const radio = page.getByRole("radio", { name: /^RPE 1:/ });
  // Check first: React restores a radio's value from its props when the radio changes.
  await radio.check();
  await radio.evaluate((el, value) => ((el as HTMLInputElement).value = value), rpe);
}

async function fillLogForm(page: Page, values: typeof VALID) {
  await page.getByLabel("Pace (mm:ss por km)").fill(values.pace);
  await page.getByLabel("Distância (km)").fill(values.distanceKm);
  await page.getByLabel("Duração (min)").fill(values.durationMin);
  await pickRpe(page, values.rpe);
  await page.getByRole("button", { name: "Salvar registro" }).click();
}

test("submitting a valid workout log marks the session done", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  const session = await firstUnloggedSession(planId);
  const date = formatSessionDay(session.date);

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

const dayOf = formatSessionDay;

test("editing a log overwrites its stored values", async ({ page }) => {
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId);
  const session = await firstUnloggedSession(planId);
  await logWorkout(session.id, { actualPaceSecPerKm: 300, actualDistanceKm: 5, actualDurationMin: 25, rpe: 5 });

  await page.goto("/dashboard");
  const row = page.getByRole("listitem").filter({ hasText: dayOf(session.date) });
  await row.getByRole("link", { name: "Editar registro" }).click();
  await expect(page.getByRole("heading", { name: "Editar registro" })).toBeVisible();
  // The form shows the stored values before they are overwritten.
  await expect(page.getByLabel("Pace (mm:ss por km)")).toHaveValue("5:00");
  await expect(page.getByRole("radio", { name: /^RPE 5:/ })).toBeChecked();
  await fillLogForm(page, { pace: "4:50", distanceKm: "10.5", durationMin: "51", rpe: "8" });

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("listitem").filter({ hasText: dayOf(session.date) })).toContainText(
    "Pace real: 4:50/km",
  );
  const logs = await prisma.workoutLog.findMany({ where: { sessionId: session.id } });
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({ actualPaceSecPerKm: 290, actualDistanceKm: 10.5, actualDurationMin: 51, rpe: 8 });
});

test("deleting a log reverts the session to pending or missed", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  // Week 1 started 3 days ago: it holds sessions both before and after today.
  const { planId } = await seedActivePlan(userId, { daysAgo: 3 });
  const week = await prisma.week.findFirstOrThrow({ where: { planId }, orderBy: { weekNumber: "asc" } });
  const todayStart = appToday();
  const past = await prisma.session.findFirstOrThrow({ where: { weekId: week.id, date: { lt: todayStart } } });
  const future = await prisma.session.findFirstOrThrow({
    where: { weekId: week.id, date: { gt: new Date(todayStart.getTime() + 86400000) } },
  });

  for (const { session, expected } of [
    { session: past, expected: "Perdida" },
    { session: future, expected: "Pendente" },
  ]) {
    await logWorkout(session.id);
    await page.goto("/dashboard");
    const row = page.getByRole("listitem").filter({ hasText: dayOf(session.date) });
    await expect(row).toContainText("Feito");
    await row.getByRole("link", { name: "Editar registro" }).click();
    await page.getByRole("button", { name: "Apagar registro" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const reverted = page.getByRole("listitem").filter({ hasText: dayOf(session.date) });
    await expect(reverted).toContainText(expected);
    await expect(reverted).not.toContainText("Feito");
    await expect(reverted).not.toContainText("Pace real");
    expect(await prisma.workoutLog.count({ where: { sessionId: session.id } })).toBe(0);
  }
});

test("a session in an already-reassessed week can still be logged, edited and deleted", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  // Week 1 ended 3 days ago; opening the dashboard reassesses it (DASH-04).
  const { planId } = await seedActivePlan(userId, { daysAgo: 10 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Semana 2" })).toBeVisible();
  const week1 = await prisma.week.findFirstOrThrow({ where: { planId, weekNumber: 1 } });
  expect(week1.reassessedAt).not.toBeNull();
  const session = await prisma.session.findFirstOrThrow({ where: { weekId: week1.id } });

  await page.goto(`/dashboard/log/${session.id}`);
  await fillLogForm(page, VALID);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await prisma.workoutLog.findUnique({ where: { sessionId: session.id } })).toMatchObject({
    actualPaceSecPerKm: 310,
    rpe: 6,
  });

  await page.goto(`/dashboard/log/${session.id}`);
  await expect(page.getByRole("radio", { name: /^RPE 6:/ })).toBeChecked();
  await fillLogForm(page, { ...VALID, rpe: "9" });
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await prisma.workoutLog.findUnique({ where: { sessionId: session.id } })).toMatchObject({ rpe: 9 });

  await page.goto(`/dashboard/log/${session.id}`);
  await page.getByRole("button", { name: "Apagar registro" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await prisma.workoutLog.count({ where: { sessionId: session.id } })).toBe(0);
});
