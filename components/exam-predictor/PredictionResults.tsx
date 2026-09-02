"use client";

import { useMemo } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PredictionQuestionCard } from "./PredictionQuestionCard";
import { EXAM_PREDICTOR_COLORS as C } from "./palette";
import type { ExtractedSyllabus, PaperPrediction, PyqMapResult, PredictedQuestion } from "@/lib/syllabus/models/syllabus.types";

interface Props {
  syllabus: ExtractedSyllabus;
  prediction: PaperPrediction;
  pyqMap: PyqMapResult | null;
  previousPapersUsed: number;
  onGetAnswer: (q: PredictedQuestion) => void;
  onAskStrategy: () => void;
  onBack: () => void;
  onDelete: () => void;
}

function unitForTopic(syllabus: ExtractedSyllabus, topic: string): string {
  const match = syllabus.units.find((u) => u.topics.some((t) => t.toLowerCase() === topic.toLowerCase()));
  return match ? `Unit ${match.unitNumber}: ${match.title}` : "General / Cross-unit";
}

function SandSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5" style={{ background: C.canvas, border: `1px solid ${C.wineRed}` }}>
      <h3 className="text-base font-semibold" style={{ color: C.onCanvas }}>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PredictionResults({ syllabus, prediction, pyqMap, previousPapersUsed, onGetAnswer, onAskStrategy, onBack, onDelete }: Props) {
  const high = prediction.expectedQuestions.filter((q) => q.probabilityScore >= 70);
  const medium = prediction.expectedQuestions.filter((q) => q.probabilityScore >= 40 && q.probabilityScore < 70);
  const low = prediction.expectedQuestions.filter((q) => q.probabilityScore < 40);

  const byUnit = useMemo(() => {
    const map = new Map<string, PredictedQuestion[]>();
    for (const q of prediction.expectedQuestions) {
      const unit = unitForTopic(syllabus, q.topic);
      map.set(unit, [...(map.get(unit) ?? []), q]);
    }
    return Array.from(map.entries());
  }, [syllabus, prediction]);

  const topThree = [...prediction.mostImportantTopics].sort((a, b) => b.probabilityScore - a.probabilityScore).slice(0, 3);
  const repeated = pyqMap?.entries.filter((e) => e.coverageStatus === "covered" && e.matchedQuestions.length > 1) ?? [];

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: C.onCanvasMuted }}
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: C.onCanvasMuted }}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>

      <SandSection title="Prediction Overview">
        <p className="text-sm" style={{ color: C.onCanvasMuted }}>
          Analyzed <span style={{ color: C.onCanvas, fontWeight: 600 }}>{syllabus.subjectName}</span> across{" "}
          {syllabus.units.length} units, with {previousPapersUsed} previous paper{previousPapersUsed === 1 ? "" : "s"} for
          pattern matching.{" "}
          {previousPapersUsed === 0 &&
            "No previous papers were supplied, so predictions are based on syllabus structure alone and may be less reliable."}
        </p>
      </SandSection>

      {high.length > 0 && (
        <SandSection title="High Probability Questions">
          <div className="flex flex-col gap-3">
            {high.map((q, i) => (
              <PredictionQuestionCard key={i} question={q} onGetAnswer={onGetAnswer} />
            ))}
          </div>
        </SandSection>
      )}

      {medium.length > 0 && (
        <SandSection title="Medium Probability Questions">
          <div className="flex flex-col gap-3">
            {medium.map((q, i) => (
              <PredictionQuestionCard key={i} question={q} onGetAnswer={onGetAnswer} />
            ))}
          </div>
        </SandSection>
      )}

      {low.length > 0 && (
        <SandSection title="Low Probability Questions">
          <div className="flex flex-col gap-3">
            {low.map((q, i) => (
              <PredictionQuestionCard key={i} question={q} onGetAnswer={onGetAnswer} />
            ))}
          </div>
        </SandSection>
      )}

      <SandSection title="Important Topics">
        <div className="flex flex-col gap-2">
          {prediction.mostImportantTopics.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              style={{ background: C.wineRedFaint }}
            >
              <div>
                <p style={{ color: C.onCanvas, fontWeight: 500 }}>{t.topic}</p>
                <p className="text-xs" style={{ color: C.onCanvasMuted }}>
                  {t.reason}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold" style={{ color: C.lightSand }}>
                {t.probabilityScore}%
              </span>
            </div>
          ))}
        </div>
      </SandSection>

      {repeated.length > 0 && (
        <SandSection title="Repeated Questions">
          <div className="flex flex-col gap-2">
            {repeated.map((e, i) => (
              <div key={i} className="rounded-lg px-3 py-2 text-sm" style={{ background: C.wineRedFaint }}>
                <p style={{ color: C.onCanvas, fontWeight: 500 }}>{e.syllabusTopic}</p>
                <p className="text-xs" style={{ color: C.onCanvasMuted }}>
                  {e.matchedQuestions.length} similar questions across supplied papers &middot; {e.notes}
                </p>
              </div>
            ))}
          </div>
        </SandSection>
      )}

      <SandSection title="Unit-wise Predictions">
        <div className="flex flex-col gap-3">
          {byUnit.map(([unit, qs]) => (
            <div key={unit}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.onCanvasMuted }}>
                {unit}
              </p>
              <p className="text-sm" style={{ color: C.onCanvas }}>
                {qs.length} predicted question{qs.length === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      </SandSection>

      <div className="rounded-2xl p-5" style={{ background: C.wineRed }}>
        <h3 className="text-base font-semibold" style={{ color: C.onWineRed }}>
          Exam Strategy
        </h3>
        <p className="mt-2 text-sm" style={{ color: `${C.onWineRed}D9` }}>
          Start with{" "}
          {topThree.map((t, i) => (
            <span key={i} style={{ color: C.onWineRed, fontWeight: 600 }}>
              {t.topic}
              {i < topThree.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          — these carry the strongest combined probability and marks weightage.
        </p>
        <button
          onClick={onAskStrategy}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: C.lightSand, color: C.onSand }}
        >
          Ask AI for a full strategy
        </button>
      </div>
    </div>
  );
}
