import { expect, test } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { DAYS_PER_WEEK_ERROR } from "../lib/domain/plan-generator";
import { RACE_DATE_ERROR } from "../lib/domain/plan-lifecycle";
import { paceForVdot } from "../lib/domain/vdot";
import { prisma } from "../lib/prisma";
import { appToday } from "../lib/domain/clock";

test.beforeEach(async ({ page }) => {
  const userId = await getSeededUserId();
  await resetPlans(userId);
  await login(page);
});

test("shows the active plan's race type, date, days and current VDOT", async ({ page }) => {
  const userId = await getSeededUserId();
  // A 10km plan on Mon/Wed/Sat; its VDOT then moves on from the initial one, as a retest would.
  const { planId } = await seedActivePlan(userId, { days: [1, 3, 6] });
  await prisma.plan.update({ where: { id: planId }, data: { currentVdot: 52.4 } });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  await page.goto("/settings");

  const config = page.getByRole("region", { name: "Plano ativo" });
  await expect(config.getByRole("definition").nth(0)).toHaveText("10km");
  await expect(config.getByRole("definition").nth(1)).toHaveText(plan.raceDate.toISOString().slice(0, 10));
  await expect(config.getByRole("definition").nth(2)).toHaveText("Seg, Qua, Sáb");
  await expect(config.getByRole("definition").nth(3)).toHaveText("52.4");
  await expect(config.getByRole("term")).toHaveText(["Prova", "Data da prova", "Dias de treino", "VDOT atual"]);
});

test("with no active plan, settings links to plan creation instead of showing empty fields", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByText("Nenhum plano ativo.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar um novo plano" })).toHaveAttribute("href", "/plan/new");
  await expect(page.getByRole("region", { name: "Plano ativo" })).toHaveCount(0);
  await expect(page.getByText("VDOT atual")).toHaveCount(0);
});

const DAY_MS = 86400000;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

async function setDays(page: import("@playwright/test").Page, days: string[]) {
  const form = page.getByRole("form", { name: "Editar plano" });
  for (const label of WEEKDAYS) {
    const box = form.getByRole("checkbox", { name: label, exact: true });
    if (days.includes(label)) await box.check();
    else await box.uncheck();
  }
}

test("changing days from settings triggers the same recalculation as plan editing", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  // Week 1 (Sun-Fri) has ended and holds a log; week 2 is the current week.
  const { planId } = await seedActivePlan(userId, { daysAgo: 10 });
  const week1 = await prisma.week.findFirstOrThrow({ where: { planId, weekNumber: 1 } });
  const logged = await prisma.session.findFirstOrThrow({ where: { weekId: week1.id }, orderBy: { date: "asc" } });
  await logWorkout(logged.id, { actualPaceSecPerKm: 301 });
  // The plan's VDOT has moved on since it started: the rebuild must use this one (EDIT-03).
  await prisma.plan.update({ where: { id: planId }, data: { currentVdot: 55 } });
  const week1Before = await prisma.session.findMany({
    where: { weekId: week1.id },
    orderBy: { date: "asc" },
    include: { workoutLog: true },
  });

  await page.goto("/settings");
  await setDays(page, ["Seg", "Qua", "Sex"]);
  await page.getByRole("button", { name: "Salvar alterações" }).click();

  // Rebuilding the remaining weeks on the live DB takes several seconds.
  await expect(page.getByRole("region", { name: "Plano ativo" }).getByRole("definition").nth(2)).toHaveText(
    "Seg, Qua, Sex",
    { timeout: 30000 },
  );
  await expect(page).toHaveURL(/\/settings$/);

  // The ended, logged week is untouched, log included.
  const week1After = await prisma.session.findMany({
    where: { weekId: week1.id },
    orderBy: { date: "asc" },
    include: { workoutLog: true },
  });
  expect(week1After).toEqual(week1Before);

  // Every week from the current one on is rebuilt on Mon/Wed/Fri from currentVdot.
  const later = await prisma.week.findMany({
    where: { planId, weekNumber: { gte: 2 } },
    include: { sessions: true },
    orderBy: { weekNumber: "asc" },
  });
  expect(later.length).toBeGreaterThan(1);
  for (const week of later) {
    expect(week.sessions.map((s) => s.date.getUTCDay()).sort()).toEqual([1, 3, 5]);
    for (const session of week.sessions) {
      if (week.phase === "TAPER") continue; // taper volumes differ, paces still follow currentVdot
      expect(session.plannedPaceSecPerKm).toBe(paceForVdot(55, session.type).secPerKm);
    }
  }
  expect((await prisma.plan.findUniqueOrThrow({ where: { id: planId } })).daysPerWeek).toEqual([1, 3, 5]);
});

test("editing to an invalid race date or day count is rejected with the plan-creation validation message", async ({
  page,
}) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  const { planId } = await seedActivePlan(userId, { days: [1, 3, 6] });
  const before = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const alert = page.locator("main").getByRole("alert");

  // Two days a week: PLAN-04's range.
  await page.goto("/settings");
  await setDays(page, ["Seg", "Qua"]);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(alert).toHaveText(DAYS_PER_WEEK_ERROR);

  // A race date before the current week.
  await page.goto("/settings");
  await page.getByLabel("Nova data da prova").fill(new Date(appToday().getTime() - 30 * DAY_MS).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(alert).toHaveText(RACE_DATE_ERROR);

  const after = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  expect(after).toMatchObject({ raceDate: before.raceDate, daysPerWeek: before.daysPerWeek });
});
