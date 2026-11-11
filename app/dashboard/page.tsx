import { PlanStatus } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";

import { RETEST_DISMISS_COOKIE } from "./constants";
import { RaceResultPrompt } from "./race-result-prompt";
import { RetestPrompt } from "./retest-prompt";
import { BottomNav } from "@/components/bottom-nav";
import { CheckIcon, ClockIcon, FlagIcon, PencilIcon, RunIcon, XIcon } from "@/components/icons";
import { appToday, daysUntil } from "@/lib/domain/clock";
import { getSeededUserId } from "@/lib/domain/auth";
import { archivePastPlans } from "@/lib/domain/plan-lifecycle";
import { deriveSessionStatus, type SessionStatus } from "@/lib/domain/session-status";
import { isRetestDue } from "@/lib/domain/vdot";
import { isWeekDue, reassessIfDue } from "@/lib/domain/weekly-adjustment";
import {
  formatIsoDay,
  formatLongDay,
  formatPace,
  formatSessionDay,
  PHASE_LABEL,
  RACE_NAME,
  SESSION_LABEL,
  STATUS_LABEL,
  WEEKDAY_SHORT,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

// This page reads the active plan and today's date on every request (DASH-01..04); without this,
// Next.js would prerender it once at build time and serve a stale snapshot forever.
export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<SessionStatus, { className: string; Icon: typeof CheckIcon }> = {
  PENDING: { className: "chip chip-primary", Icon: ClockIcon },
  DONE: { className: "chip chip-success", Icon: CheckIcon },
  MISSED: { className: "chip chip-error", Icon: XIcon },
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface DashboardPageProps {
  searchParams: Promise<{ retestError?: string; raceResultError?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { retestError, raceResultError } = await searchParams;
  const userId = await getSeededUserId();
  const today = appToday();

  // Spec LIFE-01 / PLANS-10: once its race date has passed, a plan - followed or paused - is
  // archived before anything renders.
  await archivePastPlans(userId, today);

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
    // Spec PLANS-11: with paused plans kept, the empty state points to the plans screen.
    const hasPaused = (await prisma.plan.count({ where: { userId, status: PlanStatus.PAUSED } })) > 0;
    return (
      <>
        <main className="page page--nav">
          {askForResult && <RaceResultPrompt planId={latest.id} error={raceResultError} />}
          <section className="card card-hero" style={{ justifyItems: "start" }}>
            <span className="icon-badge">
              <FlagIcon />
            </span>
            <h1>Nenhum plano ativo</h1>
            <p>Escolha sua próxima prova-alvo e o coach monta a planilha semana a semana.</p>
            {hasPaused && (
              <Link href="/plans" className="btn btn-block">
                Ver meus planos
              </Link>
            )}
            <Link href="/plan/new" className={hasPaused ? "btn btn-secondary btn-block" : "btn btn-block"}>
              Criar um novo plano
            </Link>
          </section>
        </main>
        <BottomNav />
      </>
    );
  }

  // Spec DASH-04: settle every ended, not-yet-reassessed week (oldest first, so paces cascade
  // correctly even if more than one week went by unvisited) before rendering the week that follows.
  for (const week of plan.weeks) {
    if (isWeekDue(week, today)) {
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
  const dismissedToday = (await cookies()).get(RETEST_DISMISS_COOKIE)?.value === formatIsoDay(today);
  const showRetestPrompt = Boolean(lastVdot && isRetestDue(lastVdot.date, today) && !dismissedToday);

  const withStatus = sessions.map((s) => ({ ...s, status: deriveSessionStatus(s, Boolean(s.workoutLog), today) }));
  const daysLeft = daysUntil(plan.raceDate, today);
  const weekNumber = currentWeek?.weekNumber ?? 0;
  const progress = weeks.length ? Math.round((weekNumber / weeks.length) * 100) : 0;
  const plannedKm = sessions.reduce((sum, s) => sum + (s.plannedDistanceKm ?? 0), 0);
  const doneCount = withStatus.filter((s) => s.status === "DONE").length;
  // The current week's 7 calendar days, for the at-a-glance strip above the session cards.
  const strip = currentWeek
    ? Array.from({ length: 7 }, (_, i) => {
        const date = new Date(currentWeek.startDate.getTime() + i * DAY_MS);
        const session = withStatus.find((s) => formatIsoDay(s.date) === formatIsoDay(date));
        return { date, status: session?.status, isToday: formatIsoDay(date) === formatIsoDay(today) };
      })
    : [];

  return (
    <>
      <main className="page page--nav">
        <header className="page-header">
          <span className="eyebrow">{currentWeek ? `Fase ${PHASE_LABEL[currentWeek.phase]}` : "Planilha"}</span>
          <h1>Semana {currentWeek?.weekNumber ?? "-"}</h1>
          <p className="muted">
            {doneCount} de {sessions.length} treinos feitos ·{" "}
            <span className="metric">{plannedKm.toFixed(1)}km</span> planejados
          </p>
        </header>

        {showRetestPrompt && <RetestPrompt planId={plan.id} error={retestError} />}

        <section aria-label="Próxima prova" className="card card-hero">
          <div className="row between">
            <span className="chip chip-primary">
              <FlagIcon size={14} /> Prova-alvo
            </span>
            <span className="muted">{formatLongDay(plan.raceDate)}</span>
          </div>
          <div className="row between" style={{ alignItems: "flex-end" }}>
            <div>
              <h2 style={{ fontSize: 24, lineHeight: "30px" }}>{RACE_NAME[plan.raceType]}</h2>
              <span className="muted">
                VDOT <span className="metric">{plan.currentVdot.toFixed(1)}</span>
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="metric-display" style={{ color: "var(--primary)" }}>
                {Math.max(daysLeft, 0)}d
              </span>
              <span className="metric-label">{daysLeft === 0 ? "É hoje!" : "até a largada"}</span>
            </div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row between muted" style={{ fontSize: 12, lineHeight: "16px" }}>
              <span>
                Semana {weekNumber} de {weeks.length}
              </span>
              <span className="metric">{progress}%</span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="Progresso do plano"
              aria-valuemin={0}
              aria-valuemax={weeks.length}
              aria-valuenow={weekNumber}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </section>

        <section aria-labelledby="planilha" className="stack-lg">
          <h2 id="planilha">Planilha da semana</h2>
          <div className="week-strip" aria-hidden="true">
            {strip.map(({ date, status, isToday }) => (
              <div key={date.toISOString()} className={isToday ? "today" : undefined}>
                {WEEKDAY_SHORT[date.getUTCDay()]}
                <span className="day-num">{date.getUTCDate()}</span>
                <span className={`dot ${status ?? ""}`} />
              </div>
            ))}
          </div>

          <ul className="session-list">
            {withStatus.map((session) => {
              const { status } = session;
              const chip = STATUS_CHIP[status];
              const log = session.workoutLog;
              return (
                <li key={session.id} data-status={status} className="card session-card">
                  <div className="row between">
                    <time className="muted" dateTime={formatIsoDay(session.date)}>
                      {formatSessionDay(session.date)}
                    </time>
                    <span className={chip.className}>
                      <chip.Icon size={14} />
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <strong className="session-title">{SESSION_LABEL[session.type]}</strong>
                  <div className="metric-grid">
                    <div className="metric-box">
                      <span className="metric-label">
                        Pace planejado<span className="sr-only">: </span>
                      </span>
                      <span className="metric-sm">{formatPace(session.plannedPaceSecPerKm)}</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">
                        Distância<span className="sr-only">: </span>
                      </span>
                      <span className="metric-sm">{session.plannedDistanceKm}km</span>
                    </div>
                    <div className="metric-box">
                      <span className="metric-label">
                        Duração<span className="sr-only">: </span>
                      </span>
                      <span className="metric-sm">{session.plannedDurationMin}min</span>
                    </div>
                  </div>
                  {log && (
                    <p className="row" style={{ color: "var(--on-surface)", fontSize: 14 }}>
                      <span>
                        Pace real: <span className="metric">{formatPace(log.actualPaceSecPerKm)}</span>
                      </span>
                      <span className="muted">
                        · {log.actualDistanceKm}km · RPE {log.rpe}
                      </span>
                    </p>
                  )}
                  {/* Spec NOTE-05: the note written when logging. */}
                  {log?.notes && (
                    <p className="muted" style={{ fontSize: 14, overflowWrap: "anywhere" }}>
                      <span className="sr-only">Observação: </span>
                      {log.notes}
                    </p>
                  )}
                  <Link
                    href={`/dashboard/log/${session.id}`}
                    className={log ? "btn btn-secondary btn-block" : "btn btn-block"}
                  >
                    {log ? <PencilIcon size={18} /> : <RunIcon size={18} />}
                    {log ? "Editar registro" : "Registrar treino"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
