"use client";

import { useState } from "react";

import { paceFromRun } from "@/lib/domain/pace";
import { formatPace } from "@/lib/format";

// Spec LOG-01 (AD-007): the runner types distance and duration; the pace is shown from them as they
// type, and the Server Action stores the same paceFromRun value.
export function RunFields({ distanceKm, durationMin }: { distanceKm?: number; durationMin?: number }) {
  const [distance, setDistance] = useState(distanceKm?.toString() ?? "");
  const [duration, setDuration] = useState(durationMin?.toString() ?? "");
  const pace = paceFromRun(Number(distance || NaN), Number(duration || NaN));

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
          Duração (min)
          <input
            name="durationMin"
            type="number"
            inputMode="numeric"
            step="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>
      <div className="metric-box" role="status" aria-live="polite" aria-label="Pace calculado">
        <span className="metric-label">Pace calculado</span>
        <span className="metric-sm">{pace === null ? "Informe distância e duração" : formatPace(pace)}</span>
      </div>
    </>
  );
}
