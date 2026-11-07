import { Phase, RaceType, SessionType, VdotSource, type Plan } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { calculateVdot, isPlausibleResult, paceForVdot } from "./vdot";

/** Day of week, 0 = Sunday .. 6 = Saturday (matches `Date#getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_MS = 24 * 60 * 60 * 1000;

// Recommended minimum plan length per race type (spec PLAN-02). Exported so the UI can name the
// deficit when a plan comes in below this (T27).
export const MINIMUM_WEEKS: Record<RaceType, number> = {
  [RaceType.FIVE_K]: 8,
  [RaceType.TEN_K]: 10,
  [RaceType.HALF]: 12,
  [RaceType.MARATHON]: 16,
};

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

export function computePlanWeeks(
  raceType: RaceType,
  raceDate: Date,
  today: Date,
): { weeks: number; belowMinimum: boolean } {
  const minimum = MINIMUM_WEEKS[raceType];
  if (minimum === undefined) {
    throw new Error(`Unsupported race type: ${raceType}`);
  }
  const weeks = Math.floor((utcDayNumber(raceDate) - utcDayNumber(today)) / 7);
  return { weeks, belowMinimum: weeks < minimum };
}

// Shared with plan editing, which must reject with the same message (spec EDIT-02).
export const DAYS_PER_WEEK_ERROR = "Choose between 3 and 6 training days per week.";

export function validateDaysPerWeek(days: Weekday[]): boolean {
  return days.length >= 3 && days.length <= 6;
}

export interface PhaseAssignment {
  /** 1-based position of the week within the plan. */
  weekNumber: number;
  phase: Phase;
}

// Spec PLAN-05: taper = ceil(10% of N) clamped to [1,3]; of the remaining weeks,
// base 40% / build 35% / peak 25%, with the rounding remainder added to base.
export function splitPhases(totalWeeks: number): PhaseAssignment[] {
  const taper = Math.min(totalWeeks, 3, Math.max(1, Math.ceil(totalWeeks * 0.1)));
  const remaining = totalWeeks - taper;
  const build = Math.floor(remaining * 0.35);
  const peak = Math.floor(remaining * 0.25);
  const base = remaining - build - peak;

  const phases: Phase[] = [
    ...Array<Phase>(base).fill(Phase.BASE),
    ...Array<Phase>(build).fill(Phase.BUILD),
    ...Array<Phase>(peak).fill(Phase.PEAK),
    ...Array<Phase>(taper).fill(Phase.TAPER),
  ];
  return phases.map((phase, i) => ({ weekNumber: i + 1, phase }));
}

export interface SessionDraft {
  date: Date;
  type: SessionType;
  plannedPaceSecPerKm: number;
  plannedDistanceKm: number;
  plannedDurationMin: number;
}

const { EASY: E, LONG: L, TEMPO: T, INTERVAL: I } = SessionType;

// Session types per phase, indexed by days per week, assigned in date order (spec PLAN-06):
// base leans on Easy/Long, build/peak add Tempo/Interval, taper keeps one light Tempo.
const PHASE_PATTERNS: Record<Phase, Record<number, SessionType[]>> = {
  [Phase.BASE]: {
    3: [E, E, L],
    4: [E, E, E, L],
    5: [E, E, E, E, L],
    6: [E, E, E, E, E, L],
  },
  [Phase.BUILD]: {
    3: [T, I, L],
    4: [T, E, I, L],
    5: [T, E, I, E, L],
    6: [T, E, I, E, E, L],
  },
  [Phase.PEAK]: {
    3: [I, T, L],
    4: [I, E, T, L],
    5: [I, E, T, I, L],
    6: [I, E, T, E, I, L],
  },
  [Phase.TAPER]: {
    3: [E, T, E],
    4: [E, T, E, E],
    5: [E, T, E, E, E],
    6: [E, T, E, E, E, E],
  },
};

// Planned minutes per session type; distance follows from the VDOT pace (spec PLAN-07).
const DURATION_MIN: Record<SessionType, number> = {
  [SessionType.EASY]: 40,
  [SessionType.LONG]: 75,
  [SessionType.TEMPO]: 25,
  [SessionType.INTERVAL]: 20,
};
const TAPER_VOLUME_FACTOR = 0.6;

export function generateSessions(
  week: PhaseAssignment & { startDate: Date },
  days: Weekday[],
  vdot: number,
): SessionDraft[] {
  const start = utcDayNumber(week.startDate) * DAY_MS;
  const dates: Date[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(start + offset * DAY_MS);
    if (days.includes(date.getUTCDay() as Weekday)) dates.push(date);
  }

  const pattern = PHASE_PATTERNS[week.phase][dates.length];
  const volume = week.phase === Phase.TAPER ? TAPER_VOLUME_FACTOR : 1;

  return dates.map((date, i) => {
    const type = pattern[i];
    const plannedPaceSecPerKm = paceForVdot(vdot, type).secPerKm;
    const plannedDurationMin = Math.round(DURATION_MIN[type] * volume);
    const plannedDistanceKm =
      Math.round(((plannedDurationMin * 60) / plannedPaceSecPerKm) * 100) / 100;
    return { date, type, plannedPaceSecPerKm, plannedDistanceKm, plannedDurationMin };
  });
}

export interface CreatePlanInput {
  userId: string;
  raceType: RaceType;
  raceDate: Date;
  daysPerWeek: Weekday[];
  /** How the initial VDOT was established (spec VDOT-03). */
  vdotSource: typeof VdotSource.TEST | typeof VdotSource.MANUAL;
  result: { distanceKm: number; timeSec: number };
  today: Date;
}

export async function createPlan(
  input: CreatePlanInput,
): Promise<{ plan: Plan; belowMinimum: boolean }> {
  const { userId, raceType, raceDate, daysPerWeek, vdotSource, result, today } = input;

  if (!validateDaysPerWeek(daysPerWeek)) {
    throw new Error(DAYS_PER_WEEK_ERROR);
  }
  if (!isPlausibleResult(result.distanceKm, result.timeSec)) {
    throw new Error("The time entered is not plausible for that distance.");
  }

  const { weeks, belowMinimum } = computePlanWeeks(raceType, raceDate, today);
  const vdot = calculateVdot(result.distanceKm, result.timeSec);
  const startDay = utcDayNumber(today) * DAY_MS;

  // SPEC_DEVIATION: raised from Prisma's 5000ms default interactive-transaction timeout.
  // Reason: against the live pooled Supabase connection, creating a full plan's Week/Session rows
  // one network round trip at a time can exceed 5s for longer plans; T27's e2e tests (the first to
  // exercise this against the real DB, not vitest's mocked prisma) hit "Transaction already
  // closed" at exactly that threshold.
  const plan = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        userId,
        raceType,
        raceDate,
        startDate: new Date(startDay),
        daysPerWeek,
        initialVdot: vdot,
        currentVdot: vdot,
      },
    });
    await tx.vdotHistory.create({
      data: { planId: plan.id, date: new Date(startDay), vdot, source: vdotSource },
    });

    for (const assignment of splitPhases(weeks)) {
      const startDate = new Date(startDay + (assignment.weekNumber - 1) * 7 * DAY_MS);
      await tx.week.create({
        data: {
          planId: plan.id,
          weekNumber: assignment.weekNumber,
          phase: assignment.phase,
          startDate,
          endDate: new Date(startDate.getTime() + 6 * DAY_MS),
          sessions: {
            create: generateSessions({ ...assignment, startDate }, daysPerWeek, vdot),
          },
        },
      });
    }
    return plan;
  }, { timeout: 20000 });

  return { plan, belowMinimum };
}
