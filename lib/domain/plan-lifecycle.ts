import { PlanStatus, RaceType, VdotSource, type VdotHistory } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { calculateVdot } from "./vdot";

const RACE_DISTANCE_KM: Record<RaceType, number> = {
  [RaceType.FIVE_K]: 5,
  [RaceType.TEN_K]: 10,
  [RaceType.HALF]: 21.0975,
  [RaceType.MARATHON]: 42.195,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

// Spec LIFE-01: archive once today has passed the race date. Race day itself is still active.
export async function archiveIfPast(planId: string, today: Date): Promise<void> {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  if (plan.status !== PlanStatus.ACTIVE) return;
  if (utcDayNumber(plan.raceDate) >= utcDayNumber(today)) return;
  await prisma.plan.update({ where: { id: planId }, data: { status: PlanStatus.ARCHIVED } });
}

// Spec LIFE-03: the finish time becomes a RaceResult and a race-sourced VdotHistory entry.
export async function recordRaceResult(
  planId: string,
  finishTimeSec: number,
): Promise<VdotHistory> {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });
    const vdot = calculateVdot(RACE_DISTANCE_KM[plan.raceType], finishTimeSec);
    await tx.raceResult.create({
      data: { planId, finishTimeSec, date: plan.raceDate, vdotComputed: vdot },
    });
    return tx.vdotHistory.create({
      data: { planId, date: plan.raceDate, vdot, source: VdotSource.RACE },
    });
  });
}

// Spec LIFE-04/LIFE-05: a new plan starts from the previous plan's race result if one was recorded,
// otherwise from its last currentVdot.
// SPEC_DEVIATION: design.md types the return as `Promise<number>`; this returns `number | null`.
// Reason: with no previous plan there is nothing to carry over (tasks.md T21), and the caller falls
// through to the normal VDOT-establishment flow.
export async function initialVdotForNewPlan(previousPlanId?: string): Promise<number | null> {
  if (!previousPlanId) return null;
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: previousPlanId },
    include: { raceResult: true },
  });
  return plan.raceResult?.vdotComputed ?? plan.currentVdot;
}
