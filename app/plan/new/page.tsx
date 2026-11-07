import { RaceType } from "@prisma/client";
import { redirect } from "next/navigation";

import { computePlanWeeks, MINIMUM_WEEKS } from "@/lib/domain/plan-generator";
import { prisma } from "@/lib/prisma";

import { createPlanAction, type EstablishedVdot } from "./actions";

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

  // PLAN-01..04 need an established VDOT first (VDOT-01..03); send the user to that step.
  if (!source || !Number.isFinite(distanceKm) || !Number.isFinite(timeSec)) {
    redirect("/plan/new/vdot");
  }

  const vdotResult: EstablishedVdot = { distanceKm, timeSec, source };
  const action = createPlanAction.bind(null, vdotResult);

  return (
    <main style={main}>
      <h1>Nova prova</h1>
      {params.error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {params.error}
        </p>
      )}
      <form action={action} style={{ display: "grid", gap: 20, marginTop: 16 }}>
        <fieldset style={field}>
          <legend>Tipo de prova</legend>
          {Object.values(RaceType).map((type) => (
            <label key={type} style={{ display: "block" }}>
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
            <label key={day} style={{ display: "block" }}>
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
        Prova de {RACE_LABEL[plan.raceType]} em {plan.weeks.length} semanas.
      </p>
      {belowMinimum && (
        <p role="alert">
          Esse plano tem {totalWeeks} semanas, abaixo do mínimo recomendado de {minimum} semanas
          para uma prova de {RACE_LABEL[plan.raceType]} (faltam {minimum - totalWeeks} semanas).
        </p>
      )}
      <ol>
        {plan.weeks.map((week) => (
          <li key={week.id}>
            Semana {week.weekNumber} — {week.phase}
          </li>
        ))}
      </ol>
    </main>
  );
}
