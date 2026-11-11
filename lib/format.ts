// Presentation-only formatting shared by the pages (no business rules: those live in lib/domain).
import { Phase, RaceType, SessionType } from "@prisma/client";

import type { SessionStatus } from "@/lib/domain/session-status";

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const RACE_LABEL: Record<RaceType, string> = {
  [RaceType.FIVE_K]: "5km",
  [RaceType.TEN_K]: "10km",
  [RaceType.HALF]: "21km",
  [RaceType.MARATHON]: "42km",
};

export const RACE_NAME: Record<RaceType, string> = {
  [RaceType.FIVE_K]: "5K",
  [RaceType.TEN_K]: "10K",
  [RaceType.HALF]: "Meia maratona",
  [RaceType.MARATHON]: "Maratona",
};

export const SESSION_LABEL: Record<SessionType, string> = {
  [SessionType.EASY]: "Rodagem leve",
  [SessionType.LONG]: "Longão",
  [SessionType.TEMPO]: "Tempo run",
  [SessionType.INTERVAL]: "Intervalado",
};

export const PHASE_LABEL: Record<Phase, string> = {
  [Phase.BASE]: "Base",
  [Phase.BUILD]: "Construção",
  [Phase.PEAK]: "Pico",
  [Phase.TAPER]: "Polimento",
};

export const STATUS_LABEL: Record<SessionStatus, string> = {
  PENDING: "Pendente",
  DONE: "Feito",
  MISSED: "Perdida",
};

/** 300 -> "5:00/km" */
export function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}/km`;
}

/** A calendar day (UTC midnight) as YYYY-MM-DD. */
export function formatIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A calendar day (UTC midnight) as "Ter, 10/11". */
export function formatSessionDay(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${WEEKDAY_SHORT[date.getUTCDay()]}, ${dd}/${mm}`;
}

/** A calendar day (UTC midnight) as "10 nov 2026". */
export function formatLongDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** 2490 -> "41:30", 5025 -> "1:23:45" */
export function formatFinishTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Spec DEL-01: the confirmation asked before a plan is deleted. */
export function deletePlanMessage(raceType: RaceType): string {
  return `Excluir o plano de ${RACE_NAME[raceType]}? Todas as semanas, treinos e registros dele serão apagados. Isso não pode ser desfeito.`;
}
