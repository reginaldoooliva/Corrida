import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";

// The seeded account (prisma/seed.ts) comes from the same .env the app reads.
loadEnvConfig(process.cwd());
const USERNAME = process.env.SEED_USERNAME!;
const PASSWORD = process.env.SEED_PASSWORD!;

async function submitLogin(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test.beforeAll(() => {
  expect(USERNAME, "SEED_USERNAME must be set in .env").toBeTruthy();
  expect(PASSWORD, "SEED_PASSWORD must be set in .env").toBeTruthy();
});

test("login succeeds with correct credentials and redirects to dashboard", async ({ page, context }) => {
  await submitLogin(page, USERNAME, PASSWORD);

  await expect(page).toHaveURL(/\/dashboard$/);
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.endsWith("next-auth.session-token"))).toBe(true);
  // The session is real: the protected page stays reachable instead of bouncing to /login.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("login with wrong credentials shows generic invalid-credentials message", async ({ page, context }) => {
  for (const [username, password] of [
    [USERNAME, `${PASSWORD}-wrong`],
    [`${USERNAME}-nobody`, PASSWORD],
  ]) {
    await submitLogin(page, username, password);

    // Same message whichever field was wrong (AUTH-02).
    await expect(page.locator("form").getByRole("alert")).toHaveText("Credenciais inválidas.");
    await expect(page).toHaveURL(/\/login$/);
  }
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.endsWith("next-auth.session-token"))).toBe(false);
});

test("visiting /dashboard while logged out redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login(\?.*)?$/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("visiting /register and /signup returns 404", async ({ page }) => {
  for (const path of ["/register", "/signup"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("the root URL leads to the app, not a placeholder page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});
