import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { removeWorkoutLog, submitWorkoutLog } from "./actions";

// Reads the session and its log on every request.
export const dynamic = "force-dynamic";

const main = { maxWidth: 480, margin: "6vh auto", padding: 24 } as const;
const field = { display: "grid", gap: 4 } as const;
const input = { padding: "8px 10px", fontSize: 16 } as const;

interface LogPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}

// Spec LOG-01/02: the workout log form for one session - pace, distance, duration and RPE. The
// form skips the browser's own validation (noValidate) so the LOG-02 bounds are enforced, and
// their errors named, by the Server Action in every case.
export default async function LogPage({ params, searchParams }: LogPageProps) {
  const { sessionId } = await params;
  const { error } = await searchParams;
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { workoutLog: true } });
  if (!session) notFound();

  const submitAction = submitWorkoutLog.bind(null, sessionId);
  const removeAction = removeWorkoutLog.bind(null, sessionId);
  // Spec LOG-03: an existing log pre-fills the form; saving overwrites it.
  const log = session.workoutLog;
  const pace = log
    ? `${Math.floor(log.actualPaceSecPerKm / 60)}:${String(log.actualPaceSecPerKm % 60).padStart(2, "0")}`
    : undefined;

  return (
    <main style={main}>
      <h1>{log ? "Editar registro" : "Registrar treino"}</h1>
      <p>Sessão de {session.date.toISOString().slice(0, 10)}</p>
      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}
      <form action={submitAction} noValidate style={{ display: "grid", gap: 12 }}>
        <label style={field}>
          Pace (mm:ss por km)
          <input name="pace" type="text" inputMode="numeric" placeholder="5:30" defaultValue={pace} style={input} />
        </label>
        <label style={field}>
          Distância (km)
          <input name="distanceKm" type="number" step="0.01" defaultValue={log?.actualDistanceKm} style={input} />
        </label>
        <label style={field}>
          Duração (min)
          <input name="durationMin" type="number" step="1" defaultValue={log?.actualDurationMin} style={input} />
        </label>
        <label style={field}>
          RPE (1 a 10)
          <input name="rpe" type="number" step="1" defaultValue={log?.rpe} style={input} />
        </label>
        <button type="submit">Salvar registro</button>
      </form>
      {log && (
        <form action={removeAction} style={{ marginTop: 12 }}>
          <button type="submit">Apagar registro</button>
        </form>
      )}
      <p>
        <Link href="/dashboard">Voltar ao dashboard</Link>
      </p>
    </main>
  );
}
