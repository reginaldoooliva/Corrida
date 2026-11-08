import { expect, test } from "@playwright/test";

import { getSeededUserId, login, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";

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
