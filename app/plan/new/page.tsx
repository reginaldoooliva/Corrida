import { RaceType } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeftIcon, FlagIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { getSeededUserId } from "@/lib/domain/auth";
import { computePlanWeeks, MINIMUM_WEEKS } from "@/lib/domain/plan-generator";
import { carryOverVdot } from "@/lib/domain/plan-lifecycle";
import { formatLongDay, PHASE_LABEL, RACE_LABEL, RACE_NAME, WEEKDAY_SHORT } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { createCarryOverPlanAction, createPlanAction, type EstablishedVdot } from "./actions";

const RACE_HINT: Record<RaceType, string> = {
  [RaceType.FIVE_K]: "5K",
  [RaceType.TEN_K]: "10K",
  [RaceType.HALF]: "Meia maratona",
  [RaceType.MARATHON]: "Maratona",
};

const PHASE_CHIP: Record<string, string> = {
  BASE: "chip chip-secondary",
  BUILD: "chip",
  PEAK: "chip chip-primary",
  TAPER: "chip chip-success",
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
          <label className="field">
            VDOT inicial
            <input name="vdot" type="number" inputMode="decimal" step="0.1" defaultValue={carried.vdot.toFixed(1)} required />
          </label>
          <p className="hint" style={{ marginTop: -8 }}>
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
    <main className="page" style={{ maxWidth: 480 }}>
      <Link href="/dashboard" className="back-link">
        <ArrowLeftIcon size={18} /> Voltar ao dashboard
      </Link>
      <header className="page-header">
        <p className="eyebrow">Passo 2 de 2 · Prova-alvo</p>
        <h1>Nova prova</h1>
        <p>Escolha a distância, a data e os dias em que você pode treinar.</p>
      </header>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form action={action} className="card form" style={{ gap: 24 }}>
        {children}
        <fieldset>
          <legend>Tipo de prova</legend>
          <div className="race-options">
            {Object.values(RaceType).map((type) => (
              <label key={type} className="race-option">
                <input type="radio" name="raceType" value={type} required />
                <span>
                  <strong>{RACE_LABEL[type]}</strong>
                  <small aria-hidden="true">{RACE_HINT[type]}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          Data da prova
          <input name="raceDate" type="date" required />
        </label>

        <fieldset>
          <legend>Dias de treino (3 a 6 por semana)</legend>
          <div className="chip-group days">
            {WEEKDAY_SHORT.map((label, day) => (
              <label key={day} className="chip-option">
                <input type="checkbox" name="days" value={day} /> {label}
              </label>
            ))}
          </div>
        </fieldset>

        <SubmitButton pendingText="Montando a planilha..." className="btn-block">
          Criar plano
        </SubmitButton>
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
    <main className="page" style={{ maxWidth: 480 }}>
      <header className="page-header">
        <span className="eyebrow">Planilha pronta</span>
        <h1>Plano criado</h1>
        <p>
          Prova de {RACE_LABEL[plan.raceType]} em {weeks(plan.weeks.length)}.
        </p>
      </header>
      <section aria-label="Resumo do plano" className="card card-hero">
        <div className="row between">
          <span className="chip chip-primary">
            <FlagIcon size={14} /> {RACE_NAME[plan.raceType]}
          </span>
          <span className="muted">{formatLongDay(plan.raceDate)}</span>
        </div>
        <div className="metric-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="metric-box">
            <span className="metric-label">Semanas</span>
            <span className="metric-md">{plan.weeks.length}</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">VDOT</span>
            <span className="metric-md">{plan.currentVdot.toFixed(1)}</span>
          </div>
        </div>
      </section>
      {belowMinimum && (
        <p role="alert" className="alert alert-warning">
          Esse plano tem {weeks(totalWeeks)}, abaixo do mínimo recomendado de {weeks(minimum)} para
          uma prova de {RACE_LABEL[plan.raceType]} (faltam {weeks(minimum - totalWeeks)}).
        </p>
      )}
      <section aria-labelledby="periodizacao" className="stack">
        <h2 id="periodizacao">Periodização</h2>
        <ol className="timeline">
          {plan.weeks.map((week) => (
            <li key={week.id}>
              <span className="metric-sm">Semana {week.weekNumber}</span> —{" "}
              <span className={PHASE_CHIP[week.phase]}>{PHASE_LABEL[week.phase]}</span>
            </li>
          ))}
        </ol>
      </section>
      <Link href="/dashboard" className="btn btn-block">
        Ir para o painel
      </Link>
    </main>
  );
}
