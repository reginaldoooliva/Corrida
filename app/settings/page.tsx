import { PlanStatus, RaceType } from "@prisma/client";
import Link from "next/link";

import { getSeededUserId } from "@/lib/domain/auth";
import { prisma } from "@/lib/prisma";

import { updatePlanSettings } from "./actions";

// Reads the active plan on every request (SET-01/03); never a build-time snapshot.
export const dynamic = "force-dynamic";

const main = { maxWidth: 560, margin: "6vh auto", padding: 24 } as const;

const RACE_LABEL: Record<RaceType, string> = {
  [RaceType.FIVE_K]: "5km",
  [RaceType.TEN_K]: "10km",
  [RaceType.HALF]: "21km (meia maratona)",
  [RaceType.MARATHON]: "42km (maratona)",
};

const WEEKDAY_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const field = { display: "grid", gap: 4 } as const;

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
      <main style={main}>
        <h1>Configurações</h1>
        <p>Nenhum plano ativo.</p>
        <p>
          <Link href="/plan/new">Criar um novo plano</Link>
        </p>
      </main>
    );
  }

  // Spec SET-01: the active plan's race type, race date, training days and current VDOT.
  const days = [...plan.daysPerWeek].sort((a, b) => a - b).map((d) => WEEKDAY_LABEL[d]);

  return (
    <main style={main}>
      <h1>Configurações</h1>
      <section aria-label="Plano ativo">
        <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "8px 16px" }}>
          <dt>Prova</dt>
          <dd style={{ margin: 0 }}>{RACE_LABEL[plan.raceType]}</dd>
          <dt>Data da prova</dt>
          <dd style={{ margin: 0 }}>{plan.raceDate.toISOString().slice(0, 10)}</dd>
          <dt>Dias de treino</dt>
          <dd style={{ margin: 0 }}>{days.join(", ")}</dd>
          <dt>VDOT atual</dt>
          <dd style={{ margin: 0 }}>{plan.currentVdot.toFixed(1)}</dd>
        </dl>
      </section>

      {/* Spec SET-02: change the race date or training days; the plan is recalculated from the
          current week on (EDIT-01..03). */}
      <h2>Editar plano</h2>
      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      <form action={updatePlanSettings} aria-label="Editar plano" style={{ display: "grid", gap: 16 }}>
        <label style={field}>
          Nova data da prova
          <input
            name="raceDate"
            type="date"
            required
            defaultValue={plan.raceDate.toISOString().slice(0, 10)}
            style={{ padding: "8px 10px", fontSize: 16 }}
          />
        </label>
        <fieldset style={field}>
          <legend>Dias de treino (3 a 6 por semana)</legend>
          {WEEKDAY_LABEL.map((label, day) => (
            <label key={day} style={{ display: "block" }}>
              <input type="checkbox" name="days" value={day} defaultChecked={plan.daysPerWeek.includes(day)} />{" "}
              {label}
            </label>
          ))}
        </fieldset>
        <button type="submit" style={{ padding: "10px 12px", fontSize: 16 }}>
          Salvar alterações
        </button>
      </form>
      <p>
        <Link href="/dashboard">Voltar ao dashboard</Link>
      </p>
    </main>
  );
}
