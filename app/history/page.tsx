import { PlanStatus, RaceType } from "@prisma/client";
import Link from "next/link";

import { appToday } from "@/lib/domain/clock";
import { getSeededUserId } from "@/lib/domain/auth";
import { weeklyAdherence } from "@/lib/domain/session-status";
import { prisma } from "@/lib/prisma";

// Reads the plan's VdotHistory and logs on every request (HIST-01/02); never a build-time snapshot.
export const dynamic = "force-dynamic";

const main = { maxWidth: 640, margin: "6vh auto", padding: 24 } as const;

const WIDTH = 560;
const HEIGHT = 220;
const PAD = 32;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}/km`;
}

interface PacePoint {
  date: Date;
  planned: number;
  actual: number;
}

// Spec HIST-02: per logged session (oldest first), the planned pace and the actual one. Faster
// paces sit higher, as a runner reads them.
function PaceChart({ points }: { points: PacePoint[] }) {
  const paces = points.flatMap((p) => [p.planned, p.actual]);
  const [fast, slow] = [Math.min(...paces) - 10, Math.max(...paces) + 10];
  const x = (i: number) => (points.length === 1 ? WIDTH / 2 : PAD + (i / (points.length - 1)) * (WIDTH - 2 * PAD));
  const y = (sec: number) => PAD + ((sec - fast) / (slow - fast)) * (HEIGHT - 2 * PAD);
  const series = [
    { key: "planejado", color: "#999", value: (p: PacePoint) => p.planned },
    { key: "real", color: "#2e7d32", value: (p: PacePoint) => p.actual },
  ];

  return (
    <svg role="img" aria-label="Pace real vs. planejado" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%">
      <text x={4} y={PAD} fontSize={11}>
        {formatPace(fast)}
      </text>
      <text x={4} y={HEIGHT - PAD} fontSize={11}>
        {formatPace(slow)}
      </text>
      {series.map((s) => (
        <g key={s.key}>
          <polyline
            points={points.map((p, i) => `${x(i)},${y(s.value(p))}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
          />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(s.value(p))} r={5} fill={s.color}>
              <title>{`${formatDate(p.date)} ${s.key}: ${formatPace(s.value(p))}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

interface VdotPoint {
  date: Date;
  vdot: number;
}

// Spec HIST-01: one point per VdotHistory entry, x by date, y by VDOT, joined oldest to newest.
function VdotChart({ points }: { points: VdotPoint[] }) {
  const times = points.map((p) => p.date.getTime());
  const vdots = points.map((p) => p.vdot);
  const [minT, maxT] = [Math.min(...times), Math.max(...times)];
  const [minV, maxV] = [Math.min(...vdots) - 1, Math.max(...vdots) + 1];
  const x = (t: number) => (maxT === minT ? WIDTH / 2 : PAD + ((t - minT) / (maxT - minT)) * (WIDTH - 2 * PAD));
  const y = (v: number) => HEIGHT - PAD - ((v - minV) / (maxV - minV)) * (HEIGHT - 2 * PAD);
  const coords = points.map((p) => [x(p.date.getTime()), y(p.vdot)] as const);

  return (
    <svg role="img" aria-label="VDOT ao longo do tempo" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%">
      <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="#999" />
      <text x={4} y={PAD} fontSize={11}>
        {maxV.toFixed(0)}
      </text>
      <text x={4} y={HEIGHT - PAD} fontSize={11}>
        {minV.toFixed(0)}
      </text>
      <polyline points={coords.map(([cx, cy]) => `${cx},${cy}`).join(" ")} fill="none" stroke="#1565c0" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={coords[i][0]} cy={coords[i][1]} r={5} fill="#1565c0">
          <title>{`${formatDate(p.date)}: VDOT ${p.vdot.toFixed(1)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

const RACE_LABEL: Record<RaceType, string> = {
  [RaceType.FIVE_K]: "5km",
  [RaceType.TEN_K]: "10km",
  [RaceType.HALF]: "21km",
  [RaceType.MARATHON]: "42km",
};

function formatFinishTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = String(totalSec % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

interface HistoryPageProps {
  searchParams: Promise<{ plan?: string }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { plan: selectedId } = await searchParams;
  const userId = await getSeededUserId();
  // Spec HIST-03: every plan can be picked; with none picked, the active plan is shown (or, with
  // no active plan, the latest one).
  const plans = await prisma.plan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, raceType: true, raceDate: true },
  });
  const selected =
    plans.find((p) => p.id === selectedId) ?? plans.find((p) => p.status === PlanStatus.ACTIVE) ?? plans[0];
  const plan = await prisma.plan.findFirst({
    where: { id: selected?.id ?? "", userId },
    include: {
      raceResult: true,
      vdotHistory: { orderBy: { date: "asc" } },
      weeks: {
        orderBy: { weekNumber: "asc" },
        include: { sessions: { orderBy: { date: "asc" }, include: { workoutLog: true } } },
      },
    },
  });

  if (!plan) {
    return (
      <main style={main}>
        <h1>Histórico</h1>
        <p>Nenhum plano ainda.</p>
        <p>
          <Link href="/plan/new">Criar um novo plano</Link>
        </p>
      </main>
    );
  }

  const today = appToday();
  const pacePoints = plan.weeks.flatMap((w) =>
    w.sessions.flatMap((s) =>
      s.workoutLog ? [{ date: s.date, planned: s.plannedPaceSecPerKm, actual: s.workoutLog.actualPaceSecPerKm }] : [],
    ),
  );
  // SPEC_DEVIATION: HIST-02 says "per week" without saying which weeks. Only weeks that have
  // started are listed - a future week's 0/N is not adherence, just a plan.
  const startedWeeks = plan.weeks.filter((w) => w.startDate <= today);

  return (
    <main style={main}>
      <h1>Histórico</h1>
      <nav aria-label="Planos">
        <ul>
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/history?plan=${p.id}`} aria-current={p.id === plan.id ? "page" : undefined}>
                {RACE_LABEL[p.raceType]} - {formatDate(p.raceDate)} (
                {p.status === PlanStatus.ACTIVE ? "atual" : "arquivado"})
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {plan.raceResult && (
        <p>
          Resultado da prova: {formatFinishTime(plan.raceResult.finishTimeSec)} (VDOT{" "}
          {plan.raceResult.vdotComputed.toFixed(1)})
        </p>
      )}
      <h2>VDOT ao longo do tempo</h2>
      <VdotChart points={plan.vdotHistory} />
      <h2>Pace real vs. planejado</h2>
      {/* Spec HIST-04: an explicit empty state instead of an empty chart. */}
      {pacePoints.length > 0 ? <PaceChart points={pacePoints} /> : <p>Nenhum treino registrado neste plano ainda.</p>}
      <h2>Aderência semanal</h2>
      <ul aria-label="Aderência semanal">
        {startedWeeks.map((w) => {
          const { done, planned } = weeklyAdherence(
            w.sessions.map((s) => ({ date: s.date, hasLog: Boolean(s.workoutLog) })),
            today,
          );
          return (
            <li key={w.id}>
              Semana {w.weekNumber}: {done} de {planned} sessões feitas
            </li>
          );
        })}
      </ul>
      <p>
        <Link href="/dashboard">Voltar ao dashboard</Link>
      </p>
    </main>
  );
}
