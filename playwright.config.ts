import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // The suite runs against the live (remote, pooled) Supabase DB: a test's setup alone - login,
  // reset, seeding a plan - takes ~20s, and a server's first request is slower still. Playwright's
  // 30s/5s defaults made otherwise-green tests fail on latency alone.
  timeout: 60000,
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
