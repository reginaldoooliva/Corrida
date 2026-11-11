import { PlanStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ArrowLeftIcon } from "@/components/icons";
import { RunFields } from "@/components/run-fields";
import { RpePicker } from "@/components/rpe-picker";
import { SubmitButton } from "@/components/submit-button";
import { formatPace, formatSessionDay, SESSION_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { deleteSessionAction, removeWorkoutLog, submitWorkoutLog } from "./actions";

// Reads the session and its log on every request.
export const dynamic = "force-dynamic";

interface LogPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ error?: string }>;
}

// Spec LOG-01/02: the workout log form for one session - distance, duration (the pace shown from
// them, AD-007) and RPE. The form skips the browser's own validation (noValidate) so the LOG-02 bounds are enforced, and
// their errors named, by the Server Action in every case.
export default async function LogPage({ params, searchParams }: LogPageProps) {
  const { sessionId } = await params;
  const { error } = await searchParams;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { workoutLog: true, week: { select: { plan: { select: { status: true } } } } },
  });
  if (!session) notFound();

  const submitAction = submitWorkoutLog.bind(null, sessionId);
  const removeAction = removeWorkoutLog.bind(null, sessionId);
  // Spec LOG-03: an existing log pre-fills the form; saving overwrites it.
  const log = session.workoutLog;

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
        <RunFields distanceKm={log?.actualDistanceKm} durationSec={log?.actualDurationSec} />
        <RpePicker defaultValue={log?.rpe} />
        {/* Spec NOTE-01/04: an optional note, pre-filled when editing. Its 500-character limit is
            checked on save (NOTE-02), so a longer paste gets the error instead of being cut. */}
        <label className="field">
          Observação (opcional)
          <textarea name="notes" rows={3} defaultValue={log?.notes ?? ""} aria-describedby="notes-hint" />
        </label>
        <span id="notes-hint" className="hint" style={{ marginTop: -10 }}>
          Como foi o treino, até 500 caracteres.
        </span>
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
      {/* Spec DEL-07: only a session of the followed plan can be deleted, after confirmation. */}
      {session.week.plan.status === PlanStatus.ACTIVE && (
        <ConfirmDialog
          label="Excluir treino"
          message={`Excluir o treino de ${formatSessionDay(session.date)}? O registro dele, se houver, também será apagado.`}
          action={deleteSessionAction.bind(null, sessionId)}
          fields={{}}
        />
      )}
    </main>
  );
}
