import { dismissRetestPrompt, submitRetestResult } from "./actions";
import { TimerIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";

// Spec VDOT-04/05: shown on the dashboard once the active plan's latest VDOT is 4+ weeks old;
// reuses the same distance/minutes/seconds result shape as the VDOT establishment flow (T26).
export function RetestPrompt({ planId, error }: { planId: string; error?: string }) {
  const submitAction = submitRetestResult.bind(null, planId);

  return (
    <section aria-label="Aviso de reteste de VDOT" className="card card-warning">
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <span className="icon-badge" style={{ background: "var(--surface-card)", color: "var(--warning)" }}>
          <TimerIcon />
        </span>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Hora de um novo teste</h2>
          <p>Seu VDOT está desatualizado (4 semanas ou mais desde o último teste). Faça um novo teste.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form action={submitAction} className="form">
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
        <SubmitButton pendingText="Enviando...">Enviar resultado</SubmitButton>
      </form>
      <form action={dismissRetestPrompt}>
        <button type="submit" className="btn-ghost btn-block">
          Agora não
        </button>
      </form>
    </section>
  );
}
