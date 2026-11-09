import { PlanStatus, SessionType } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";

import { RETEST_DISMISS_COOKIE } from "./constants";
import { RaceResultPrompt } from "./race-result-prompt";
import { RetestPrompt } from "./retest-prompt";
import { appToday } from "@/lib/domain/clock";
import { getSeededUserId } from "@/lib/domain/auth";
import { archiveIfPast } from "@/lib/domain/plan-lifecycle";
import { deriveSessionStatus, type SessionStatus } from "@/lib/domain/session-status";
import { isRetestDue } from "@/lib/domain/vdot";
import { reassessIfDue } from "@/lib/domain/weekly-adjustment";
import { prisma } from "@/lib/prisma";

// This page reads the active plan and today's date on every request (DASH-01..04); without this,
// Next.js would prerender it once at build time and serve a stale snapshot forever.
export const dynamic = "force-dynamic";

const main = { maxWidth: 640, margin: "6vh auto", padding: 24 } as const;
// T42: a 44px-tall tap area for the dashboard's links on a phone.
const tapLink = { display: "inline-block", padding: "12px 0" } as const;

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

interface DashboardPageProps {
  searchParams: Promise<{ retestError?: string; raceResultError?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { retestError, raceResultError } = await searchParams;
  const userId = await getSeededUserId();
  const today = appToday();

  // Spec LIFE-01: once its race date has passed, the active plan is archived before anything renders.
  const active = await prisma.plan.findFirst({ where: { userId, status: PlanStatus.ACTIVE } });
  if (active) await archiveIfPast(active.id, today);

  const plan = await prisma.plan.findFirst({
    where: { userId, status: PlanStatus.ACTIVE },
    include: { weeks: { orderBy: { weekNumber: "asc" } } },
  });

  if (!plan) {
    // Spec LIFE-02: the latest plan, archived without a RaceResult, asks for the race's finish time.
    const latest = await prisma.plan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { raceResult: true },
    });
    const askForResult = latest?.status === PlanStatus.ARCHIVED && !latest.raceResult;
    return (
      <main style={main}>
        {askForResult && <RaceResultPrompt planId={latest.id} error={raceResultError} />}
        <h1>Nenhum plano ativo</h1>
        <p>
          <Link href="/plan/new">Criar um novo plano</Link>
        </p>
      </main>
    );
  }

  // Spec DASH-04: settle every ended, not-yet-reassessed week (oldest first, so paces cascade
  // correctly even if more than one week went by unvisited) before rendering the week that follows.
  for (const week of plan.weeks) {
    if (!week.reassessedAt && week.endDate < today) {
      await reassessIfDue(week.id);
    }
  }
  const weeks = await prisma.week.findMany({
    where: { planId: plan.id },
    orderBy: { weekNumber: "asc" },
  });

  // Spec DASH-01 + Edge Case (taper-week rounding): the current week is the one today falls in;
  // the latest week that has already started stands in once today is past every week's range -
  // which is also the plan's last (taper) week once the race date hasn't arrived yet, so its
  // sessions render again instead of an empty week.
  const started = weeks.filter((w) => w.startDate <= today);
  const currentWeek = started[started.length - 1] ?? weeks[0];

  const sessions = currentWeek
    ? await prisma.session.findMany({
        where: { weekId: currentWeek.id },
        orderBy: { date: "asc" },
        include: { workoutLog: true },
      })
    : [];

  // Spec VDOT-04/05/07: show the retest banner once the latest VDOT is 4+ weeks old, unless it
  // was dismissed earlier today (the cookie's date no longer matches tomorrow, so it reappears).
  const lastVdot = await prisma.vdotHistory.findFirst({
    where: { planId: plan.id },
    orderBy: { date: "desc" },
  });
  const dismissedToday = (await cookies()).get(RETEST_DISMISS_COOKIE)?.value === formatDate(today);
  const showRetestPrompt = Boolean(lastVdot && isRetestDue(lastVdot.date, today) && !dismissedToday);

  return (
    <main style={main}>
      {showRetestPrompt && <RetestPrompt planId={plan.id} error={retestError} />}
      <h1>Semana {currentWeek?.weekNumber ?? "-"}</h1>
      <nav aria-label="Seções" style={{ display: "flex", gap: 20, margin: "4px 0 12px" }}>
        <Link href="/history" style={tapLink}>
          Histórico
        </Link>
        <Link href="/settings" style={tapLink}>
          Configurações
        </Link>
      </nav>
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
              <Link href={`/dashboard/log/${session.id}`} style={tapLink}>
                {session.workoutLog ? "Editar registro" : "Registrar treino"}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
