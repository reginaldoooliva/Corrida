import { expect, test, type Page } from "@playwright/test";

import { getSeededUserId, login, logWorkout, resetPlans, seedActivePlan } from "./helpers";
import { prisma } from "../lib/prisma";

// T41: every screen must be usable at a phone width - nothing wider than the viewport, which
// would mean horizontal scroll (or, since globals.css clips overflow-x, content cut off).
const PHONE = { width: 390, height: 844 };
test.use({ viewport: PHONE });

const SHOTS = process.env.MOBILE_SHOTS_DIR;

async function expectFitsPhoneWidth(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const overflowing = await page.evaluate((width) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > width + 1 || r.left < -1)) {
        out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, out };
  }, PHONE.width);
  expect(overflowing.out, `${name}: elements past the ${PHONE.width}px viewport`).toEqual([]);
  expect(overflowing.scrollWidth, `${name}: page scrolls horizontally`).toBeLessThanOrEqual(PHONE.width);
}

test("login fits a phone-width viewport", async ({ page }) => {
  await page.goto("/login");
  await expectFitsPhoneWidth(page, "login");
});

test("onboarding screens fit a phone-width viewport", async ({ page }) => {
  await resetPlans(await getSeededUserId());
  await login(page);
  await page.goto("/plan/new/vdot");
  await expectFitsPhoneWidth(page, "onboarding-vdot");
  await page.goto("/plan/new/vdot?mode=guided");
  await expectFitsPhoneWidth(page, "onboarding-vdot-guided");
  await page.goto("/plan/new/vdot?mode=manual");
  await expectFitsPhoneWidth(page, "onboarding-vdot-manual");
  await page.goto("/plan/new?distanceKm=5&timeSec=1197&source=MANUAL");
  await expectFitsPhoneWidth(page, "onboarding-race");
});

test("dashboard, log, history and settings fit a phone-width viewport", async ({ page }) => {
  test.setTimeout(120000);
  const userId = await getSeededUserId();
  await resetPlans(userId);
  const { planId } = await seedActivePlan(userId, { daysAgo: 3 });
  const sessions = await prisma.session.findMany({
    where: { week: { planId, weekNumber: 1 } },
    orderBy: { date: "asc" },
  });
  await logWorkout(sessions[0].id, { actualPaceSecPerKm: 290 });
  await logWorkout(sessions[1].id, { actualPaceSecPerKm: 310 });
  await login(page);

  await page.goto("/dashboard");
  await expectFitsPhoneWidth(page, "dashboard");
  await page.goto(`/dashboard/log/${sessions[2].id}`);
  await expectFitsPhoneWidth(page, "log");
  await page.goto("/history");
  await expectFitsPhoneWidth(page, "history");
  await page.goto("/settings");
  await expectFitsPhoneWidth(page, "settings");
});
