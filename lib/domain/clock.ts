// Every stored calendar date (session, week, race, VDOT test) is a UTC-midnight Date, and the
// domain compares them by UTC day number. "Today" must be built the same way, from the athlete's
// local calendar day - not `new Date()`, whose UTC day already is tomorrow from 21:00 in Brazil
// (UTC-3), which made today's sessions show as missed and weeks close a few hours early.
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function todayInTimeZone(now: Date, timeZone: string = DEFAULT_TIME_ZONE): Date {
  // en-CA formats as YYYY-MM-DD.
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${ymd}T00:00:00Z`);
}

// The current instant. APP_NOW (any Date-parsable string) fakes it for a local walk-through that
// has to cross weeks (T43: advance 4 weeks, reach race day) without editing the database. It is
// ignored on Vercel (VERCEL is set there), so production always runs on the real clock.
export function appNow(env: { APP_NOW?: string; VERCEL?: string } = process.env): Date {
  if (env.APP_NOW && !env.VERCEL) {
    const fake = new Date(env.APP_NOW);
    if (!Number.isNaN(fake.getTime())) return fake;
  }
  return new Date();
}

// The app's "today": the local calendar day in APP_TIME_ZONE (default America/Sao_Paulo).
export function appToday(now: Date = appNow()): Date {
  return todayInTimeZone(now, process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE);
}
