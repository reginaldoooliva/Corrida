import { PlanStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
