import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("new plan offers guided test or manual time entry", async ({ page }) => {
  await page.goto("/plan/new/vdot");

  await expect(page.getByRole("link", { name: /teste guiado/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /tempo de prova recente/i })).toBeVisible();
});

test("guided test shows instructions and a result entry form", async ({ page }) => {
  await page.goto("/plan/new/vdot?mode=guided");

  // VDOT-02: instructions first, no result form yet.
  await expect(page.getByText(/corra 5km ou 20 minutos/i)).toBeVisible();
  await expect(page.getByLabel("Distância (km)")).toHaveCount(0);

  await page.getByRole("link", { name: /já corri, inserir resultado/i }).click();

  await expect(page.getByLabel("Distância (km)")).toBeVisible();
  await expect(page.getByLabel("Minutos")).toBeVisible();
  await expect(page.getByLabel("Segundos")).toBeVisible();

  // An implausible time (5km in 1 minute) is rejected with a field-level error.
  await page.getByLabel("Distância (km)").fill("5");
  await page.getByLabel("Minutos").fill("1");
  await page.getByLabel("Segundos").fill("0");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/mode=guided&step=result/);
});
