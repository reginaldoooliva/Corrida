export type SessionStatus = "PENDING" | "DONE" | "MISSED";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayNumber(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS;
}

// Spec LOG-04 + future-dated log edge case: a log always means done, whatever the session date;
// otherwise the session is missed once its calendar day is before today, pending until then.
export function deriveSessionStatus(
  session: { date: Date },
  hasLog: boolean,
  today: Date,
): SessionStatus {
  if (hasLog) return "DONE";
  return utcDayNumber(session.date) < utcDayNumber(today) ? "MISSED" : "PENDING";
}
