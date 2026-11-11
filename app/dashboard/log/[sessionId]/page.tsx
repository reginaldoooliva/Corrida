import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon } from "@/components/icons";
import { RpePicker } from "@/components/rpe-picker";
import { SubmitButton } from "@/components/submit-button";
import { formatPace, formatSessionDay, SESSION_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { removeWorkoutLog, submitWorkoutLog } from "./actions";

// Reads the session and its log on every request.
export const dynamic = "force-dynamic";

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
    <main className="page" style={{ maxWidth: 480 }}>
      <Link href="/dashboard" className="back-link">
        <ArrowLeftIcon size={18} /> Voltar ao dashboard
      </Link>
      <header className="page-header">
        <span className="eyebrow">{SESSION_LABEL[session.type]}</span>
        <h1>{log ? "Editar registro" : "Registrar treino"}</h1>
        <p className="muted">Sessão de {formatSessionDay(session.date)}</p>
      </header>

      <section aria-label="Treino planejado" className="metric-grid">
        <div className="metric-box">
          <span className="metric-label">Pace alvo</span>
          <span className="metric-sm">{formatPace(session.plannedPaceSecPerKm)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Distância</span>
          <span className="metric-sm">{session.plannedDistanceKm}km</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Duração</span>
          <span className="metric-sm">{session.plannedDurationMin}min</span>
        </div>
      </section>

      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <form action={submitAction} noValidate className="card form">
        <label className="field">
          Pace (mm:ss por km)
          <input name="pace" type="text" inputMode="numeric" placeholder="5:30" defaultValue={pace} aria-describedby="pace-hint" />
        </label>
        <span id="pace-hint" className="hint" style={{ marginTop: -10 }}>
          Pace médio do treino, por exemplo 5:30.
        </span>
        <div className="field-row">
          <label className="field">
            Distância (km)
            <input name="distanceKm" type="number" inputMode="decimal" step="0.01" defaultValue={log?.actualDistanceKm} />
          </label>
          <label className="field">
            Duração (min)
            <input name="durationMin" type="number" inputMode="numeric" step="1" defaultValue={log?.actualDurationMin} />
          </label>
        </div>
        <RpePicker defaultValue={log?.rpe} />
        <SubmitButton pendingText="Salvando..." className="btn-block">
          Salvar registro
        </SubmitButton>
      </form>
      {log && (
        <form action={removeAction}>
          <button type="submit" className="btn-danger btn-block">
            Apagar registro
          </button>
        </form>
      )}
    </main>
  );
}
