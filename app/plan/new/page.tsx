import { Phase, RaceType } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSeededUserId } from "@/lib/domain/auth";
import { computePlanWeeks, MINIMUM_WEEKS } from "@/lib/domain/plan-generator";
import { carryOverVdot } from "@/lib/domain/plan-lifecycle";
import { prisma } from "@/lib/prisma";

import { createCarryOverPlanAction, createPlanAction, type EstablishedVdot } from "./actions";

const main = { maxWidth: 560, margin: "8vh auto", padding: 24 } as const;
const field = { display: "grid", gap: 4 } as const;
const input = { padding: "8px 10px", fontSize: 16 } as const;

const RACE_LABEL: Record<RaceType, string> = {
  [RaceType.FIVE_K]: "5km",
  [RaceType.TEN_K]: "10km",
  [RaceType.HALF]: "21km (meia maratona)",
  [RaceType.MARATHON]: "42km (maratona)",
};

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const PHASE_LABEL: Record<Phase, string> = {
  [Phase.BASE]: "Base",
  [Phase.BUILD]: "Construção",
  [Phase.PEAK]: "Pico",
  [Phase.TAPER]: "Polimento",
};

function weeks(n: number): string {
  return `${n} ${n === 1 ? "semana" : "semanas"}`;
}

interface NewPlanPageProps {
  searchParams: Promise<{
    distanceKm?: string;
    timeSec?: string;
    source?: string;
    created?: string;
    error?: string;
  }>;
}

export default async function NewPlanPage({ searchParams }: NewPlanPageProps) {
  const params = await searchParams;

  if (params.created) {
    return <PlanSummary planId={params.created} />;
  }

  const distanceKm = Number(params.distanceKm);
  const timeSec = Number(params.timeSec);
  const source = params.source === "TEST" || params.source === "MANUAL" ? params.source : undefined;

  if (!source || !Number.isFinite(distanceKm) || !Number.isFinite(timeSec)) {
    // Spec LIFE-04/05: after an archived plan, the race form opens with its carried-over VDOT,
    // editable; the VDOT step stays one link away.
    const carried = await carryOverVdot(await getSeededUserId());
    if (carried) {
      return (
        <RaceForm action={createCarryOverPlanAction} error={params.error}>
          <label style={field}>
            VDOT inicial
            <input
              name="vdot"
              type="number"
              step="0.1"
              defaultValue={carried.vdot.toFixed(1)}
              required
              style={input}
            />
          </label>
          <p>
            Vindo do seu plano anterior. <Link href="/plan/new/vdot">Prefiro fazer um novo teste</Link>
          </p>
        </RaceForm>
      );
    }
    // PLAN-01..04 need an established VDOT first (VDOT-01..03); send the user to that step.
    redirect("/plan/new/vdot");
  }

  const vdotResult: EstablishedVdot = { distanceKm, timeSec, source };
  return <RaceForm action={createPlanAction.bind(null, vdotResult)} error={params.error} />;
}

function RaceForm({
  action,
  error,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  error?: string;
  children?: React.ReactNode;
}) {
  return (
    <main style={main}>
      <h1>Nova prova</h1>
      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      <form action={action} style={{ display: "grid", gap: 20, marginTop: 16 }}>
        {children}
        <fieldset style={field}>
          <legend>Tipo de prova</legend>
          {Object.values(RaceType).map((type) => (
            <label key={type}>
              <input type="radio" name="raceType" value={type} required /> {RACE_LABEL[type]}
            </label>
          ))}
        </fieldset>

        <label style={field}>
          Data da prova
          <input name="raceDate" type="date" required style={input} />
        </label>

        <fieldset style={field}>
          <legend>Dias de treino (3 a 6 por semana)</legend>
          {WEEKDAY_LABEL.map((label, day) => (
            <label key={day}>
              <input type="checkbox" name="days" value={day} /> {label}
            </label>
          ))}
        </fieldset>

        <button type="submit" style={{ padding: "10px 12px", fontSize: 16 }}>
          Criar plano
        </button>
      </form>
    </main>
  );
}

async function PlanSummary({ planId }: { planId: string }) {
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { id: planId },
    include: { weeks: { orderBy: { weekNumber: "asc" } } },
  });
  const { weeks: totalWeeks, belowMinimum } = computePlanWeeks(
    plan.raceType,
    plan.raceDate,
    plan.startDate,
  );
  const minimum = MINIMUM_WEEKS[plan.raceType];

  return (
    <main style={main}>
      <h1>Plano criado</h1>
      <p>
        Prova de {RACE_LABEL[plan.raceType]} em {weeks(plan.weeks.length)}.
      </p>
      {belowMinimum && (
        <p role="alert">
          Esse plano tem {weeks(totalWeeks)}, abaixo do mínimo recomendado de {weeks(minimum)} para
          uma prova de {RACE_LABEL[plan.raceType]} (faltam {weeks(minimum - totalWeeks)}).
        </p>
      )}
      <ol>
        {plan.weeks.map((week) => (
          <li key={week.id}>
            Semana {week.weekNumber} — {PHASE_LABEL[week.phase]}
          </li>
        ))}
      </ol>
      <p>
        <Link href="/dashboard">Ir para o painel</Link>
      </p>
    </main>
  );
}
