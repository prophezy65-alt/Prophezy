"use client";

import { useState } from "react";
import { EXAM_PREDICTOR_COLORS as C } from "./palette";

export type OrbState = "idle" | "reading" | "comparing" | "predicting" | "done" | "thinking";

const STATE_COPY: Record<OrbState, string> = {
  idle: "Give me your syllabus or previous papers. I'll find the patterns.",
  reading: "Reading your syllabus...",
  comparing: "Comparing previous papers...",
  predicting: "Building your prediction set...",
  done: "I've analyzed your material. Ask me anything about your exam.",
  thinking: "Thinking...",
};

/** Idle-state quotes — tap the line to cycle through them. */
const IDLE_QUOTES = [
  "Give me your syllabus or previous papers. I'll find the patterns.",
  "Every past paper is a hint the examiner already gave you.",
  "Predict the question. Prepare the answer. Walk in calm.",
  "Patterns repeat. Marks don't lie. Neither do we.",
  "The syllabus is the map. Previous papers are the terrain.",
];

/** Inline mark in the same spirit as ProphezyAssistant's icon, recolored for this feature. */
function ExamPredictorMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const x1 = 32 + Math.cos(angle) * 15;
        const y1 = 32 + Math.sin(angle) * 15;
        const x2 = 32 + Math.cos(angle) * 29;
        const y2 = 32 + Math.sin(angle) * 29;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.lightSand} strokeWidth="1.4" opacity={0.8} />
            <circle cx={x2} cy={y2} r="1.6" fill={C.lightSand} opacity={0.95} />
          </g>
        );
      })}
      <circle cx="32" cy="32" r="16" fill={C.wineRedDark} stroke={C.lightSand} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="7" fill={C.lightSand} opacity={0.9} />
    </svg>
  );
}

export function ExamPredictorOrb({ state, customLine }: { state: OrbState; customLine?: string }) {
  const isActive = state !== "idle" && state !== "done";
  const [quoteIndex, setQuoteIndex] = useState(0);
  const isIdle = state === "idle" && !customLine;

  return (
    <div
      className="flex w-full max-w-3xl flex-col items-center gap-5 rounded-2xl px-10 py-14 text-center"
      style={{ background: C.wineRed }}
    >
      <div
        className="flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all duration-300"
        style={{
          borderColor: C.lightSand,
          boxShadow: isActive ? `0 0 32px ${C.lightSandSoft}` : "none",
          background: C.wineRedDark,
        }}
      >
        <div className={isActive ? "animate-pulse" : ""}>
          <ExamPredictorMark size={54} />
        </div>
      </div>

      {isIdle ? (
        <button
          type="button"
          onClick={() => setQuoteIndex((i) => (i + 1) % IDLE_QUOTES.length)}
          className="group flex flex-col items-center gap-2"
        >
          <p className="max-w-xl text-lg font-medium transition-opacity" style={{ color: C.onWineRed }}>
            {IDLE_QUOTES[quoteIndex]}
          </p>
          <span
            className="text-[11px] uppercase tracking-[0.2em] opacity-0 transition-opacity group-hover:opacity-60"
            style={{ color: C.onWineRed }}
          >
            tap for another
          </span>
        </button>
      ) : (
        <p className="max-w-xl text-lg font-medium" style={{ color: C.onWineRed }}>
          {customLine ?? STATE_COPY[state]}
        </p>
      )}
    </div>
  );
}
