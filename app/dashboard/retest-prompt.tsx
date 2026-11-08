import { dismissRetestPrompt, submitRetestResult } from "./actions";

const field = { display: "grid", gap: 4 } as const;
const input = { padding: "6px 8px", fontSize: 14 } as const;

// Spec VDOT-04/05: shown on the dashboard once the active plan's latest VDOT is 4+ weeks old;
// reuses the same distance/minutes/seconds result shape as the VDOT establishment flow (T26).
export function RetestPrompt({ planId, error }: { planId: string; error?: string }) {
  const submitAction = submitRetestResult.bind(null, planId);

  return (
    <section
      aria-label="Aviso de reteste de VDOT"
      style={{ border: "2px solid #b06d00", padding: 16, marginBottom: 16, display: "grid", gap: 12 }}
    >
      <p>Seu VDOT está desatualizado (4 semanas ou mais desde o último teste). Faça um novo teste.</p>
      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      <form action={submitAction} style={{ display: "grid", gap: 8 }}>
        <label style={field}>
          Distância (km)
          <input name="distanceKm" type="number" step="0.01" min="0.01" required style={input} />
        </label>
        <label style={field}>
          Minutos
          <input name="minutes" type="number" min="0" required style={input} />
        </label>
        <label style={field}>
          Segundos
          <input name="seconds" type="number" min="0" max="59" required style={input} />
        </label>
        <button type="submit">Enviar resultado</button>
      </form>
      <form action={dismissRetestPrompt}>
        <button type="submit">Agora não</button>
      </form>
    </section>
  );
}
