import { submitRaceResult } from "./actions";

const field = { display: "grid", gap: 4 } as const;
const input = { padding: "6px 8px", fontSize: 14 } as const;

// Spec LIFE-02: shown on the dashboard once the latest plan is archived without a RaceResult.
export function RaceResultPrompt({ planId, error }: { planId: string; error?: string }) {
  const submitAction = submitRaceResult.bind(null, planId);

  return (
    <section
      aria-label="Aviso de resultado de prova"
      style={{ border: "2px solid #1565c0", padding: 16, marginBottom: 16, display: "grid", gap: 12 }}
    >
      <p>Sua prova já passou. Informe o seu tempo final para atualizar o VDOT.</p>
      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      <form action={submitAction} style={{ display: "grid", gap: 8 }}>
        <label style={field}>
          Horas
          <input name="hours" type="number" min="0" defaultValue="0" required style={input} />
        </label>
        <label style={field}>
          Minutos
          <input name="minutes" type="number" min="0" max="59" required style={input} />
        </label>
        <label style={field}>
          Segundos
          <input name="seconds" type="number" min="0" max="59" required style={input} />
        </label>
        <button type="submit">Salvar resultado</button>
      </form>
    </section>
  );
}
