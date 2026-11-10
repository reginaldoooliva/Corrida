import Link from "next/link";

import { ArrowLeftIcon, ChevronRightIcon, FlagIcon, TimerIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";

import { submitVdotResult, type VdotMode } from "./actions";

interface VdotPageProps {
  searchParams: Promise<{
    mode?: string;
    step?: string;
    error?: string;
    field?: string;
  }>;
}

// Onboarding is two steps: establish the VDOT (here), then pick the race (/plan/new).
function Steps({ current }: { current: 1 | 2 }) {
  return (
    <p className="eyebrow" aria-label={`Passo ${current} de 2`}>
      Passo {current} de 2 · {current === 1 ? "Seu ritmo atual" : "Prova-alvo"}
    </p>
  );
}

export default async function VdotPage({ searchParams }: VdotPageProps) {
  const params = await searchParams;
  const mode = params.mode === "guided" || params.mode === "manual" ? (params.mode as VdotMode) : undefined;

  // Spec VDOT-01: no prior VDOT yet, so offer both the guided test and manual entry.
  if (!mode) {
    return (
      <main className="page" style={{ maxWidth: 480 }}>
        <header className="page-header">
          <Steps current={1} />
          <h1>Qual é o seu VDOT inicial?</h1>
          <p>
            Você ainda não tem um VDOT registrado. Ele mede seu condicionamento e define o pace de cada
            treino. Escolha como quer estabelecê-lo:
          </p>
        </header>
        <div className="stack">
          <Link href="/plan/new/vdot?mode=guided" className="choice-card">
            <span className="icon-badge">
              <TimerIcon />
            </span>
            <span>
              Fazer um teste guiado (5km ou 20 minutos)
              <small>Ideal se você não correu uma prova recentemente.</small>
            </span>
            <ChevronRightIcon className="chevron" />
          </Link>
          <Link href="/plan/new/vdot?mode=manual" className="choice-card">
            <span className="icon-badge" style={{ background: "var(--secondary-container)", color: "var(--secondary)" }}>
              <FlagIcon />
            </span>
            <span>
              Inserir um tempo de prova recente
              <small>Use um resultado dos últimos meses.</small>
            </span>
            <ChevronRightIcon className="chevron" />
          </Link>
        </div>
      </main>
    );
  }

  // Spec VDOT-02: the guided test shows instructions first, then the result-entry form.
  if (mode === "guided" && params.step !== "result") {
    return (
      <main className="page" style={{ maxWidth: 480 }}>
        <Link href="/plan/new/vdot" className="back-link">
          <ArrowLeftIcon size={18} /> Voltar
        </Link>
        <header className="page-header">
          <Steps current={1} />
          <h1>Teste guiado</h1>
        </header>
        <section className="card card-accent">
          <p style={{ color: "var(--on-surface)" }}>
            Corra 5km ou 20 minutos no esforço máximo que você conseguir sustentar até o fim. Depois
            de terminar, volte aqui e informe a distância e o tempo que você fez.
          </p>
          <p className="muted">Aqueça 10 a 15 minutos antes e escolha um percurso plano.</p>
        </section>
        <Link href="/plan/new/vdot?mode=guided&step=result" className="btn btn-block">
          Já corri, inserir resultado
        </Link>
      </main>
    );
  }

  const action = submitVdotResult.bind(null, mode);

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <Link href={mode === "guided" ? "/plan/new/vdot?mode=guided" : "/plan/new/vdot"} className="back-link">
        <ArrowLeftIcon size={18} /> Voltar
      </Link>
      <header className="page-header">
        <Steps current={1} />
        <h1>{mode === "guided" ? "Resultado do teste" : "Tempo de prova recente"}</h1>
      </header>
      {params.error && (
        <p role="alert" className="alert">
          {params.error}
        </p>
      )}
      <form action={action} className="card form">
        <label className="field">
          Distância (km)
          <input name="distanceKm" type="number" inputMode="decimal" step="0.01" min="0.01" required />
        </label>
        <div className="field-row">
          <label className="field">
            Minutos
            <input name="minutes" type="number" inputMode="numeric" min="0" required />
          </label>
          <label className="field">
            Segundos
            <input name="seconds" type="number" inputMode="numeric" min="0" max="59" required />
          </label>
        </div>
        <SubmitButton pendingText="Calculando..." className="btn-block">
          Continuar
        </SubmitButton>
      </form>
    </main>
  );
}
