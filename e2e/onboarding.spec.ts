import { expect, test, type Page } from "@playwright/test";

import { getSeededUserId, login, resetPlans } from "./helpers";
import { appToday } from "../lib/domain/clock";

test.beforeEach(async ({ page }) => {
  await resetPlans(await getSeededUserId());
  await login(page);
});

// Walks the manual-entry VDOT step (VDOT-01) and lands on /plan/new with the result carried in
// the query string, ready for the race-config form (T27).
async function establishVdotManually(page: Page, distanceKm: number, minutes: number, seconds: number) {
  await page.goto("/plan/new/vdot?mode=manual");
  await page.getByLabel("Distância (km)").fill(String(distanceKm));
  await page.getByLabel("Minutos").fill(String(minutes));
  await page.getByLabel("Segundos").fill(String(seconds));
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/plan\/new\?/);
}

function dateDaysFromNow(days: number): string {
  return new Date(appToday().getTime() + days * 86400000).toISOString().slice(0, 10);
}

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

test("a 10km plan ~10 weeks out from a manual 5km time shows ~10 weeks with the expected phase proportions", async ({
  page,
}) => {
  test.setTimeout(60000);
  // 5km in 19:57 (VDOT ~50), 10km race exactly 10 weeks out.
  await establishVdotManually(page, 5, 19, 57);

  await page.getByLabel(/10km/).check();
  await page.getByLabel("Data da prova").fill(dateDaysFromNow(70));
  for (const day of ["Seg", "Qua", "Sáb"]) {
    await page.getByRole("checkbox", { name: day }).check();
  }
  await page.getByRole("button", { name: "Criar plano" }).click();

  await expect(page.getByRole("heading", { name: "Plano criado" })).toBeVisible({ timeout: 15000 });
  const weekItems = page.getByRole("listitem");
  await expect(weekItems).toHaveCount(10);
  await expect(weekItems.filter({ hasText: "TAPER" })).toHaveCount(1);
  await expect(weekItems.filter({ hasText: "BASE" })).toHaveCount(4);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("a plan shorter than the recommended minimum still generates, with a visible warning", async ({
  page,
}) => {
  test.setTimeout(60000);
  // A 5km race just 3 weeks out: minimum recommended is 8 weeks (PLAN-02).
  await establishVdotManually(page, 5, 19, 57);

  await page.getByLabel(/5km/).check();
  await page.getByLabel("Data da prova").fill(dateDaysFromNow(21));
  for (const day of ["Seg", "Qua", "Sáb"]) {
    await page.getByRole("checkbox", { name: day }).check();
  }
  await page.getByRole("button", { name: "Criar plano" }).click();

  await expect(page.getByRole("heading", { name: "Plano criado" })).toBeVisible({ timeout: 15000 });
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /3 semanas[\s\S]*mínimo recomendado de 8 semanas/,
  );
  await expect(page.getByRole("listitem")).toHaveCount(3);
});

test("selecting fewer than 3 or more than 6 days is rejected with the 3-6 range explained", async ({
  page,
}) => {
  test.setTimeout(60000);
  await establishVdotManually(page, 5, 19, 57);

  // Fewer than 3: only 2 days checked. A rejected submit redirects back to a blank form, so
  // raceType/raceDate are re-filled before each attempt.
  await page.getByLabel(/10km/).check();
  await page.getByLabel("Data da prova").fill(dateDaysFromNow(70));
  await page.getByRole("checkbox", { name: "Seg" }).check();
  await page.getByRole("checkbox", { name: "Qua" }).check();
  await page.getByRole("button", { name: "Criar plano" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(/3 and 6/, { timeout: 15000 });

  // More than 6: all 7 weekdays checked.
  await page.getByLabel(/10km/).check();
  await page.getByLabel("Data da prova").fill(dateDaysFromNow(70));
  for (const day of ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]) {
    await page.getByRole("checkbox", { name: day }).check();
  }
  await page.getByRole("button", { name: "Criar plano" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(/3 and 6/, { timeout: 15000 });
});
