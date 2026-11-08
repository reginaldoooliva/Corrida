import { existsSync } from "node:fs";

import { defineConfig } from "@playwright/test";

// The suite wipes the seeded user's plans (e2e/helpers.ts resetPlans), so it must only ever reach
// the dev database in `.env`. `next start` runs in production mode and loads these files over
// `.env`, and so does the helpers' loadEnvConfig - once a production env file sat here, a run
// reset the production database (2026-11-08). Keep production secrets under a name Next never
// loads (e.g. `.env.deploy.local`); refuse to run otherwise.
const overridingEnvFiles = [".env.local", ".env.production", ".env.production.local"].filter((f) =>
  existsSync(f),
);
if (overridingEnvFiles.length > 0) {
  throw new Error(
    `Refusing to run e2e: ${overridingEnvFiles.join(", ")} would point the app away from the dev database in .env.`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  // The suite runs against the live (remote, pooled) Supabase DB: a test's setup alone - login,
  // reset, seeding a plan - takes ~20s, and a server's first request is slower still. Playwright's
  // 30s/5s defaults made otherwise-green tests fail on latency alone.
  timeout: 60000,
  // Every spec file resets and seeds plans for the same single seeded user, and the DB allows one
  // ACTIVE plan per user: parallel workers wipe each other's plans mid-test. Run them serially.
  workers: 1,
  expect: { timeout: 10000 },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
