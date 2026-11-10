import { PlanStatus } from "@prisma/client";
import Link from "next/link";

import { BottomNav } from "@/components/bottom-nav";
import { SettingsIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { getSeededUserId } from "@/lib/domain/auth";
import { formatIsoDay, RACE_LABEL, WEEKDAY_SHORT as WEEKDAY_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { updatePlanSettings } from "./actions";

// Reads the active plan on every request (SET-01/03); never a build-time snapshot.
export const dynamic = "force-dynamic";

interface SettingsPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { error } = await searchParams;
  const userId = await getSeededUserId();
  const plan = await prisma.plan.findFirst({ where: { userId, status: PlanStatus.ACTIVE } });

  // Spec SET-03: no active plan - say so and point to plan creation, no empty fields.
  if (!plan) {
    return (
      <>
        <main className="page page--nav">
          <h1>Configurações</h1>
          <section className="card" style={{ justifyItems: "start" }}>
            <span className="icon-badge">
              <SettingsIcon />
            </span>
            <p>Nenhum plano ativo.</p>
            <Link href="/plan/new" className="btn btn-block">
              Criar um novo plano
            </Link>
          </section>
        </main>
        <BottomNav />
      </>
    );
  }

  // Spec SET-01: the active plan's race type, race date, training days and current VDOT.
  const days = [...plan.daysPerWeek].sort((a, b) => a - b).map((d) => WEEKDAY_LABEL[d]);

  return (
    <>
      <main className="page page--nav">
        <header className="page-header">
          <span className="eyebrow">Plano ativo</span>
          <h1>Configurações</h1>
        </header>
        <section aria-label="Plano ativo" className="card">
          <dl className="facts">
            <div>
              <dt>Prova</dt>
              <dd>{RACE_LABEL[plan.raceType]}</dd>
            </div>
            <div>
              <dt>Data da prova</dt>
              <dd>{formatIsoDay(plan.raceDate)}</dd>
            </div>
            <div>
              <dt>Dias de treino</dt>
              <dd>{days.join(", ")}</dd>
            </div>
            <div>
              <dt>VDOT atual</dt>
              <dd>{plan.currentVdot.toFixed(1)}</dd>
            </div>
          </dl>
        </section>

        {/* Spec SET-02: change the race date or training days; the plan is recalculated from the
            current week on (EDIT-01..03). */}
        <section aria-labelledby="editar" className="stack">
          <h2 id="editar">Editar plano</h2>
          <p className="muted">A planilha é recalculada a partir da semana atual; o que você já correu fica.</p>
          {error && (
            <p role="alert" className="alert">
              {error}
            </p>
          )}
          <form action={updatePlanSettings} aria-label="Editar plano" className="card form" style={{ gap: 24 }}>
            <label className="field">
              Nova data da prova
              <input name="raceDate" type="date" required defaultValue={formatIsoDay(plan.raceDate)} />
            </label>
            <fieldset>
              <legend>Dias de treino (3 a 6 por semana)</legend>
              <div className="chip-group days">
                {WEEKDAY_LABEL.map((label, day) => (
                  <label key={day} className="chip-option">
                    <input type="checkbox" name="days" value={day} defaultChecked={plan.daysPerWeek.includes(day)} />{" "}
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton pendingText="Salvando..." className="btn-block">
              Salvar alterações
            </SubmitButton>
          </form>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
