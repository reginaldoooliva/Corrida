"use client";

import { useState } from "react";

import { formatDuration, paceFromRun, parseDuration } from "@/lib/domain/pace";
import { formatPace } from "@/lib/format";

function durationOrNaN(raw: string): number {
  try {
    return parseDuration(raw);
  } catch {
    return Number.NaN;
  }
}

// Spec LOG-01 (AD-007, AD-008): the runner types distance and duration, in minutes and seconds;
// the pace is shown from them as they type, and the Server Action stores the same paceFromRun value.
// The duration is text: a phone's numeric keyboard has "," but no ":", so "42,28" means 42:28.
export function RunFields({ distanceKm, durationSec }: { distanceKm?: number; durationSec?: number }) {
  const [distance, setDistance] = useState(distanceKm?.toString() ?? "");
  const [duration, setDuration] = useState(durationSec === undefined ? "" : formatDuration(durationSec));
  const pace = paceFromRun(Number(distance || NaN), durationOrNaN(duration));

  return (
    <>
      <div className="field-row">
        <label className="field">
          Distância (km)
          <input
            name="distanceKm"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </label>
        <label className="field">
          Duração (min:seg)
          <input
            name="duration"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="42:28"
            aria-describedby="duration-hint"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>
      <span id="duration-hint" className="hint" style={{ marginTop: -10 }}>
        Ex.: 42:28 ou 42,28 = 42 min e 28 s
      </span>
      <div className="metric-box" role="status" aria-live="polite" aria-label="Pace calculado">
        <span className="metric-label">Pace calculado</span>
        <span className="metric-sm">{pace === null ? "Informe distância e duração" : formatPace(pace)}</span>
      </div>
    </>
  );
}
