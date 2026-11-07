import Link from "next/link";

import { submitVdotResult, type VdotMode } from "./actions";

const main = { maxWidth: 480, margin: "10vh auto", padding: 24 } as const;
const field = { display: "grid", gap: 4 } as const;
const input = { padding: "8px 10px", fontSize: 16 } as const;
const choice = { display: "block", padding: "12px 16px", marginTop: 12, border: "1px solid #ccc" } as const;

interface VdotPageProps {
  searchParams: Promise<{
    mode?: string;
    step?: string;
    error?: string;
    field?: string;
  }>;
}

export default async function VdotPage({ searchParams }: VdotPageProps) {
  const params = await searchParams;
  const mode = params.mode === "guided" || params.mode === "manual" ? (params.mode as VdotMode) : undefined;

  // Spec VDOT-01: no prior VDOT yet, so offer both the guided test and manual entry.
  if (!mode) {
    return (
      <main style={main}>
        <h1>Qual é o seu VDOT inicial?</h1>
        <p>Você ainda não tem um VDOT registrado. Escolha como quer estabelecê-lo:</p>
        <Link href="/plan/new/vdot?mode=guided" style={choice}>
          Fazer um teste guiado (5km ou 20 minutos)
        </Link>
        <Link href="/plan/new/vdot?mode=manual" style={choice}>
          Inserir um tempo de prova recente
        </Link>
      </main>
    );
  }

  // Spec VDOT-02: the guided test shows instructions first, then the result-entry form.
  if (mode === "guided" && params.step !== "result") {
    return (
      <main style={main}>
        <h1>Teste guiado</h1>
        <p>
          Corra 5km ou 20 minutos no esforço máximo que você conseguir sustentar até o fim. Depois
          de terminar, volte aqui e informe a distância e o tempo que você fez.
        </p>
        <Link href="/plan/new/vdot?mode=guided&step=result" style={choice}>
          Já corri, inserir resultado
        </Link>
      </main>
    );
  }

  const action = submitVdotResult.bind(null, mode);

  return (
    <main style={main}>
      <h1>{mode === "guided" ? "Resultado do teste" : "Tempo de prova recente"}</h1>
      {params.error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {params.error}
        </p>
      )}
      <form action={action} style={{ display: "grid", gap: 16, marginTop: 16 }}>
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
        <button type="submit" style={{ padding: "10px 12px", fontSize: 16 }}>
          Continuar
        </button>
      </form>
    </main>
  );
}
