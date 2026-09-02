"use client";

import { EXAM_PREDICTOR_COLORS as C } from "./palette";
import type { PredictedQuestion } from "@/lib/syllabus/models/syllabus.types";

function probabilityLabel(score: number): string {
  if (score >= 70) return "High probability";
  if (score >= 40) return "Medium probability";
  return "Lower probability";
}

/** Small self-contained ring so this card's contrast doesn't depend on the shared (dark-theme) ProphecyRing. */
function ScoreRing({ value }: { value: number }) {
  const size = 60;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.lightSand} strokeOpacity={0.25} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={C.lightSand}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ color: C.onWineRed }}>
        {value}%
      </span>
    </div>
  );
}

export function PredictionQuestionCard({
  question,
  onGetAnswer,
}: {
  question: PredictedQuestion;
  onGetAnswer: (q: PredictedQuestion) => void;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center"
      style={{ background: C.wineRed }}
    >
      <ScoreRing value={question.probabilityScore} />
      <div className="min-w-0 flex-1">
        <p
          className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: C.lightSand, color: C.onSand }}
        >
          {probabilityLabel(question.probabilityScore)}
        </p>
        <p className="text-sm font-medium" style={{ color: C.onWineRed }}>
          {question.question}
        </p>
        <p className="mt-1 text-xs" style={{ color: `${C.onWineRed}B3` }}>
          Topic: {question.topic} &middot; {question.expectedMarks} marks &middot; {question.type}
        </p>
      </div>
      <button
        onClick={() => onGetAnswer(question)}
        className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: C.lightSand, color: C.onSand }}
      >
        Get Answer
      </button>
    </div>
  );
}
