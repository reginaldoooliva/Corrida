// Spec LOG-01/02 (AD-007, AD-008): the runner types distance and duration; the pace is not typed.
// Pure, so the log form shows the same values the Server Action stores.

export const DURATION_MAX_SEC = 600 * 60;
export const DURATION_FORMAT_ERROR = "Duração inválida: use minutos e segundos, ex.: 42:28 ou 42,28.";
export const DURATION_ZERO_ERROR = "Duração inválida: precisa ser maior que 0.";
export const DURATION_MAX_ERROR = "Duração inválida: no máximo 600 minutos.";

// "42" (minutes), "42:28", "42,28" or "42.28" (minutes and seconds - a phone's numeric keyboard has
// "," but no ":"), or "1:02:28" (hours too). Seconds and the minutes after an hour are 00-59.
const MIN_SEC = /^(\d{1,3})(?:[:.,]([0-5]\d))?$/;
const H_MIN_SEC = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;

/** The typed duration in seconds; throws a message naming the field when it is not one. */
export function parseDuration(raw: string): number {
  const text = raw.trim();
  let seconds: number;
  const hms = H_MIN_SEC.exec(text);
  const ms = MIN_SEC.exec(text);
  if (hms) seconds = Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  else if (ms) seconds = Number(ms[1]) * 60 + Number(ms[2] ?? 0);
  else throw new Error(DURATION_FORMAT_ERROR);
  if (seconds <= 0) throw new Error(DURATION_ZERO_ERROR);
  if (seconds > DURATION_MAX_SEC) throw new Error(DURATION_MAX_ERROR);
  return seconds;
}

/** A duration in seconds as the form shows it: "42:28", or "1:02:28" past an hour. */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Duration over distance, in whole seconds per km; null until both are positive numbers. */
export function paceFromRun(distanceKm: number, durationSec: number): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationSec)) return null;
  if (distanceKm <= 0 || durationSec <= 0) return null;
  return Math.round(durationSec / distanceKm);
}
