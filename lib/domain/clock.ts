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

// The app's "today": the local calendar day in APP_TIME_ZONE (default America/Sao_Paulo).
export function appToday(now: Date = new Date()): Date {
  return todayInTimeZone(now, process.env.APP_TIME_ZONE || DEFAULT_TIME_ZONE);
}
