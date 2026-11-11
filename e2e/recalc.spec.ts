import { expect, test } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { appToday } from "../lib/domain/clock";
import { splitPhases } from "../lib/domain/plan-generator";
import { prisma } from "../lib/prisma";

const DAY_MS = 86400000;

test.beforeEach(async ({ page }) => {
  await resetPlans(await getSeededUserId());
  await login(page);
});

test("postponing the race from settings rebuilds every week from the first", async ({ page }) => {
  test.setTimeout(180000);
  const userId = await getSeededUserId();
  // A 6-week 10K plan that started 29 days ago: today falls in week 5, weeks 1-4 are past.
  const { planId } = await seedActivePlan(userId, { daysAgo: 29, raceInDays: 14, days: [1, 3, 6] });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const week2 = await prisma.week.findFirstOrThrow({
    where: { planId, weekNumber: 2 },
    include: { sessions: { orderBy: { date: "asc" } } },
  });
  const logged = week2.sessions[0];
  await logWorkout(logged.id, { actualPaceSecPerKm: 312 });
  const weeksBefore = await prisma.week.findMany({ where: { planId }, orderBy: { weekNumber: "asc" } });
  expect(weeksBefore).toHaveLength(6);

  // Postpone the race 3 weeks: 9 weeks counted from the original start.
  const newRace = new Date(plan.raceDate.getTime() + 21 * DAY_MS);
  await page.goto("/settings");
  await page.getByLabel("Nova data da prova").fill(newRace.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("region", { name: "Plano ativo" }).getByRole("definition").nth(1)).toHaveText(
    newRace.toISOString().slice(0, 10),
    { timeout: 30000 },
  );
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

  const weeks = await prisma.week.findMany({
    where: { planId },
    orderBy: { weekNumber: "asc" },
    include: { sessions: { include: { workoutLog: true } } },
  });
  // Every week, past ones included, takes its phase from the 9-week split, from the original start.
  expect(weeks.map((w) => [w.weekNumber, w.phase])).toEqual(splitPhases(9).map((a) => [a.weekNumber, a.phase]));
  expect(weeks.map((w) => w.startDate.getTime())).toEqual(
    weeks.map((w) => plan.startDate.getTime() + (w.weekNumber - 1) * 7 * DAY_MS),
  );
  // At least one past week changed phase: the rebuild did reach before the current week.
  expect(weeksBefore.slice(0, 4).some((w, i) => w.phase !== weeks[i].phase)).toBe(true);
  // The logged session stays on its date with its log, alone on that day.
  const week2After = weeks[1];
  const kept = week2After.sessions.find((s) => s.id === logged.id);
  expect(kept?.date).toEqual(logged.date);
  expect(kept?.workoutLog?.actualPaceSecPerKm).toBe(312);
  expect(week2After.sessions.filter((s) => s.date.getTime() === logged.date.getTime())).toHaveLength(1);
  expect(appToday().getTime()).toBeGreaterThan(weeks[3].endDate.getTime());
});
