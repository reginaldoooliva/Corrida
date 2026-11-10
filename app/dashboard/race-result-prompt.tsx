import { submitRaceResult } from "./actions";
import { FlagIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";

// Spec LIFE-02: shown on the dashboard once the latest plan is archived without a RaceResult.
export function RaceResultPrompt({ planId, error }: { planId: string; error?: string }) {
  const submitAction = submitRaceResult.bind(null, planId);

  return (
    <section aria-label="Aviso de resultado de prova" className="card card-info">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <span className="icon-badge" style={{ background: "var(--surface-card)", color: "var(--secondary)" }}>
          <FlagIcon />
        </span>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Fita de chegada!</h2>
          <p>Sua prova já passou. Informe o seu tempo final para atualizar o VDOT.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form action={submitAction} className="form">
        <div className="field-row three">
          <label className="field">
            Horas
            <input name="hours" type="number" inputMode="numeric" min="0" defaultValue="0" required />
          </label>
          <label className="field">
            Minutos
            <input name="minutes" type="number" inputMode="numeric" min="0" max="59" required />
          </label>
          <label className="field">
            Segundos
            <input name="seconds" type="number" inputMode="numeric" min="0" max="59" required />
          </label>
        </div>
        <SubmitButton pendingText="Salvando...">Salvar resultado</SubmitButton>
      </form>
    </section>
  );
}
