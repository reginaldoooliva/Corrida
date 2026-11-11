"use client";

import { useState } from "react";

// Borg CR10-style descriptors for each perceived-effort level.
export const RPE_LABEL: Record<number, string> = {
  1: "Muito leve",
  2: "Leve",
  3: "Confortável",
  4: "Moderado",
  5: "Um pouco forte",
  6: "Forte",
  7: "Muito forte",
  8: "Pesado",
  9: "Quase máximo",
  10: "Máximo",
};

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Pt = readonly [number, number];
const mix = (a: Pt, b: Pt, t: number): string =>
  `${(a[0] + (b[0] - a[0]) * t).toFixed(1)} ${(a[1] + (b[1] - a[1]) * t).toFixed(1)}`;

// Effort colour: calm teal -> amber -> brand orange -> red at the top of the scale.
function effortColor(level: number): string {
  if (level <= 3) return "var(--secondary)";
  if (level <= 5) return "var(--warning)";
  if (level <= 8) return "var(--primary)";
  return "var(--error)";
}

// A stick-figure runner whose pose escalates with the effort level: a relaxed upright jog at 1,
// a forward-leaning sprint with high knees, pumping arms, speed lines and sweat at 10.
export function RunnerFigure({ level, size = 44 }: { level: number; size?: number }) {
  const t = (level - 1) / 9;
  const shoulder: Pt = [25, 16];
  const hip: Pt = [23, 27];
  const lean = 2 + 10 * t;
  const speedLines = level <= 2 ? 0 : level <= 4 ? 1 : level <= 6 ? 2 : 3;
  const lineLength = 4 + 5 * t;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={effortColor(level)}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: speedLines }, (_, i) => (
        <line key={i} x1={2 + i} y1={18 + i * 6} x2={2 + i + lineLength} y2={18 + i * 6} strokeWidth={2} opacity={0.7} />
      ))}
      <g transform={`rotate(${lean.toFixed(1)} 24 44)`}>
        <circle cx={26 + 2 * t} cy={9 + t} r={4} fill={effortColor(level)} stroke="none" />
        <path d={`M${shoulder.join(" ")} L${hip.join(" ")}`} />
        {/* back arm, front arm */}
        <path d={`M${shoulder.join(" ")} L${mix([22, 22], [18, 20], t)} L${mix([20, 26], [13, 23], t)}`} />
        <path d={`M${shoulder.join(" ")} L${mix([28, 22], [31, 19], t)} L${mix([31, 24], [33, 13], t)}`} />
        {/* back leg, front leg */}
        <path d={`M${hip.join(" ")} L${mix([21, 35], [17, 34], t)} L${mix([19, 43], [9, 36], t)}`} />
        <path d={`M${hip.join(" ")} L${mix([26, 35], [32, 29], t)} L${mix([27, 43], [31, 39], t)}`} />
      </g>
      {level >= 7 && <path d="M38 6c1.6 2.2 1.6 3.6 0 4.2c-1.6-.6-1.6-2 0-4.2z" fill={effortColor(level)} strokeWidth={1} />}
      {level >= 9 && <path d="M42 12c1.6 2.2 1.6 3.6 0 4.2c-1.6-.6-1.6-2 0-4.2z" fill={effortColor(level)} strokeWidth={1} />}
    </svg>
  );
}

// Spec LOG-01: perceived effort (RPE 1-10) picked from ten runners, from barely moving to all-out.
// Plain radios named "rpe", so the form posts the same value the Server Action validates.
export function RpePicker({ defaultValue }: { defaultValue?: number }) {
  const [selected, setSelected] = useState<number | undefined>(defaultValue);
  return (
    <fieldset className="field rpe-field" aria-describedby="rpe-hint">
      <legend>RPE (1 a 10)</legend>
      <div className="rpe-scale">
        {LEVELS.map((level) => (
          <label key={level} className="rpe-option">
            <input
              type="radio"
              name="rpe"
              value={level}
              aria-label={`RPE ${level}: ${RPE_LABEL[level]}`}
              defaultChecked={defaultValue === level}
              onChange={() => setSelected(level)}
            />
            <RunnerFigure level={level} />
            <span className="rpe-num" aria-hidden="true">
              {level}
            </span>
          </label>
        ))}
      </div>
      <p id="rpe-hint" className="hint">
        {selected ? (
          <>
            <strong>
              {selected} · {RPE_LABEL[selected]}
            </strong>{" "}
            - toque em outro corredor para mudar.
          </>
        ) : (
          "Toque no corredor que representa seu esforço: o primeiro é muito leve, o último é esforço máximo."
        )}
      </p>
    </fieldset>
  );
}
