import { PlanStatus, SessionType } from "@prisma/client";
import Link from "next/link";

import { getSeededUserId } from "@/lib/domain/auth";
import { deriveSessionStatus, type SessionStatus } from "@/lib/domain/session-status";
import { prisma } from "@/lib/prisma";

// This page reads the active plan and today's date on every request (DASH-01..04); without this,
// Next.js would prerender it once at build time and serve a stale snapshot forever.
export const dynamic = "force-dynamic";

const main = { maxWidth: 640, margin: "6vh auto", padding: 24 } as const;

const TYPE_LABEL: Record<SessionType, string> = {
  [SessionType.EASY]: "Fácil",
  [SessionType.LONG]: "Longão",
  [SessionType.TEMPO]: "Tempo",
  [SessionType.INTERVAL]: "Intervalado",
};

const STATUS_LABEL: Record<SessionStatus, string> = {
  PENDING: "Pendente",
  DONE: "Feito",
  MISSED: "Perdida",
};

function formatPace(secPerKm: number): string {
  const minutes = Math.floor(secPerKm / 60);
  const seconds = secPerKm % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const userId = await getSeededUserId();
  const plan = await prisma.plan.findFirst({
    where: { userId, status: PlanStatus.ACTIVE },
    include: { weeks: { orderBy: { weekNumber: "asc" } } },
  });

  if (!plan) {
    return (
      <main style={main}>
        <h1>Nenhum plano ativo</h1>
        <p>
          <Link href="/plan/new">Criar um novo plano</Link>
        </p>
      </main>
    );
  }

  const today = new Date();
  // Spec DASH-01: the current week is the one today falls in; the latest week that has already
  // started stands in once today is past every week's range (the T29 batch adds reassessment and
  // the taper-week edge case on top of this).
  const started = plan.weeks.filter((w) => w.startDate <= today);
  const currentWeek = started[started.length - 1] ?? plan.weeks[0];

  const sessions = currentWeek
    ? await prisma.session.findMany({
        where: { weekId: currentWeek.id },
        orderBy: { date: "asc" },
        include: { workoutLog: true },
      })
    : [];

  return (
    <main style={main}>
      <h1>Semana {currentWeek?.weekNumber ?? "-"}</h1>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {sessions.map((session) => {
          const status = deriveSessionStatus(session, Boolean(session.workoutLog), today);
          return (
            <li
              key={session.id}
              data-status={status}
              style={{ border: "1px solid #ccc", padding: 12, display: "grid", gap: 4 }}
            >
              <strong>
                {formatDate(session.date)} — {TYPE_LABEL[session.type]}
              </strong>
              <span>
                Pace planejado: {formatPace(session.plannedPaceSecPerKm)} · {session.plannedDistanceKm}km ·{" "}
                {session.plannedDurationMin}min
              </span>
              {session.workoutLog && (
                <span>Pace real: {formatPace(session.workoutLog.actualPaceSecPerKm)}</span>
              )}
              <span>{STATUS_LABEL[status]}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
