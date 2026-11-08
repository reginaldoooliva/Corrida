import { PlanStatus } from "@prisma/client";
import Link from "next/link";

import { getSeededUserId } from "@/lib/domain/auth";
import { prisma } from "@/lib/prisma";

// Reads the plan's VdotHistory on every request (HIST-01); never a build-time snapshot.
export const dynamic = "force-dynamic";

const main = { maxWidth: 640, margin: "6vh auto", padding: 24 } as const;

const WIDTH = 560;
const HEIGHT = 220;
const PAD = 32;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

export default async function HistoryPage() {
  const userId = await getSeededUserId();
  const plan = await prisma.plan.findFirst({
    where: { userId, status: PlanStatus.ACTIVE },
    include: { vdotHistory: { orderBy: { date: "asc" } } },
  });

  if (!plan) {
    return (
      <main style={main}>
        <h1>Histórico</h1>
        <p>Nenhum plano ativo.</p>
        <p>
          <Link href="/plan/new">Criar um novo plano</Link>
        </p>
      </main>
    );
  }

  return (
    <main style={main}>
      <h1>Histórico</h1>
      <h2>VDOT ao longo do tempo</h2>
      <VdotChart points={plan.vdotHistory} />
      <p>
        <Link href="/dashboard">Voltar ao dashboard</Link>
      </p>
    </main>
  );
}
