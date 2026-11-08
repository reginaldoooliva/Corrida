import { SessionType, VdotSource, type VdotHistory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Jack Daniels / Jimmy Gilbert VDOT model (Daniels' Running Formula).

// Oxygen cost (ml/kg/min) of running at `velocity` metres per minute.
function oxygenCost(velocity: number): number {
  return -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
}

// Fraction of VO2max sustainable for a race lasting `minutes`.
function fractionOfMax(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

export function calculateVdot(distanceKm: number, timeSec: number): number {
  const minutes = timeSec / 60;
  const velocity = (distanceKm * 1000) / minutes;
  return oxygenCost(velocity) / fractionOfMax(minutes);
}

// World-record 5km/10km/marathon performances sit around VDOT 85; anything
// beyond this ceiling is treated as a typo, not a real result.
const MAX_PLAUSIBLE_VDOT = 90;

export function isPlausibleResult(distanceKm: number, timeSec: number): boolean {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(timeSec)) return false;
  if (distanceKm <= 0 || timeSec <= 0) return false;
  const vdot = calculateVdot(distanceKm, timeSec);
  return vdot > 0 && vdot <= MAX_PLAUSIBLE_VDOT;
}

// Training intensity as a fraction of VDOT (Daniels' zones). Daniels runs long runs at
// E pace; Long uses the top of the E range (59-74%) so it stays distinct from Easy.
const INTENSITY: Record<SessionType, number> = {
  [SessionType.EASY]: 0.7,
  [SessionType.LONG]: 0.74,
  [SessionType.TEMPO]: 0.88,
  [SessionType.INTERVAL]: 0.975,
};

export function paceForVdot(
  vdot: number,
  sessionType: SessionType,
): { secPerKm: number } {
  // Invert oxygenCost(): solve 0.000104 v^2 + 0.182258 v - (4.6 + vo2) = 0 for v (m/min).
  const vo2 = vdot * INTENSITY[sessionType];
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  const velocity = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return { secPerKm: Math.round(60000 / velocity) };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RETEST_INTERVAL_DAYS = 28;

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

// Spec VDOT-05: a retest is due once the latest VDOT entry is 4 or more weeks old.
export function isRetestDue(lastVdotHistoryDate: Date, today: Date): boolean {
  return utcDayNumber(today) - utcDayNumber(lastVdotHistoryDate) >= RETEST_INTERVAL_DAYS;
}

// Spec VDOT-06 (recompute half): re-derive the planned pace of every session not yet done (no
// WorkoutLog) in the current week and later ones.
// SPEC_DEVIATION: tasks.md lists `recomputeFuturePaces(planId, newVdot)`; this takes `today` too.
// Reason: "the current week" depends on the date; passing it keeps this testable.
export async function recomputeFuturePaces(
  planId: string,
  newVdot: number,
  today: Date,
): Promise<void> {
  // SPEC_DEVIATION: raised from Prisma's 5000ms default interactive-transaction timeout, same
  // issue and fix as createPlan's transaction (plan-generator.ts) - a plan with many weeks left
  // can have dozens of not-yet-done sessions to update one round trip at a time against the live
  // pooled Supabase connection, found by T30's e2e test hitting the real DB.
  await prisma.$transaction(async (tx) => {
    const weeks = await tx.week.findMany({
      where: { planId },
      include: { sessions: { include: { workoutLog: true } } },
    });
    const pending = weeks
      .filter((w) => utcDayNumber(w.endDate) >= utcDayNumber(today))
      .flatMap((w) => w.sessions.filter((s) => !s.workoutLog));
    // Every session of one type gets the same pace, so one updateMany per type replaces one
    // round trip per session (~19s for a full plan against the pooled Supabase connection).
    for (const type of new Set(pending.map((s) => s.type))) {
      await tx.session.updateMany({
        where: { id: { in: pending.filter((s) => s.type === type).map((s) => s.id) } },
        data: { plannedPaceSecPerKm: paceForVdot(newVdot, type).secPerKm },
      });
    }
  }, { timeout: 20000 });
}

// Spec VDOT-06 (the other half of the gap `recomputeFuturePaces` leaves open, per tasks.md's
// Handoff): submitting a retest result (a) adds a `VdotHistory` entry with `source = RECALC`,
// (b) updates `Plan.currentVdot`, and (c) recomputes every not-yet-done session's planned pace
// from `today` on via `recomputeFuturePaces`. Mirrors `recordRaceResult`'s shape in
// plan-lifecycle.ts, with the same `isPlausibleResult` guard `createPlan` uses.
export async function recordVdotRetest(
  planId: string,
  result: { distanceKm: number; timeSec: number },
  today: Date,
): Promise<VdotHistory> {
  if (!isPlausibleResult(result.distanceKm, result.timeSec)) {
    throw new Error("The time entered is not plausible for that distance.");
  }
  const vdot = calculateVdot(result.distanceKm, result.timeSec);

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.vdotHistory.create({
      data: { planId, date: today, vdot, source: VdotSource.RECALC },
    });
    await tx.plan.update({ where: { id: planId }, data: { currentVdot: vdot } });
    return created;
  });

  await recomputeFuturePaces(planId, vdot, today);
  return entry;
}
