/**
 * app/app/interview-lab/components/EvaluationCard.tsx
 *
 * Renders a single answer's evaluation: overall score, per-dimension meters,
 * strengths/weaknesses, the model answer, and an improvement plan.
 */
"use client";

import { useState } from "react";
import { ChevronDown, Lightbulb, ThumbsDown, ThumbsUp, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScoreBadge, ScoreMeter, SectionLabel } from "./primitives";
import { SCORE_DIMENSIONS, type InterviewEvaluation } from "../types";

export function EvaluationCard({ evaluation }: { evaluation: InterviewEvaluation }) {
  const [showScores, setShowScores] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel space-y-5 p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink" style={{ fontFamily: "var(--font-display)" }}>
          Feedback
        </p>
        <ScoreBadge score={evaluation.overallScore} />
      </div>

      {evaluation.strengths.length > 0 && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <ThumbsUp size={12} className="text-success" /> Strengths
            </span>
          </SectionLabel>
          <ul className="space-y-1 text-sm text-ink/80">
            {evaluation.strengths.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-success" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.weaknesses.length > 0 && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <ThumbsDown size={12} className="text-danger" /> To improve
            </span>
          </SectionLabel>
          <ul className="space-y-1 text-sm text-ink/80">
            {evaluation.weaknesses.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-danger" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.modelAnswer && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Lightbulb size={12} className="text-signal" /> Model answer
            </span>
          </SectionLabel>
          <p className="whitespace-pre-wrap rounded-xl bg-ink/[0.03] p-3 text-sm leading-relaxed text-ink/80">
            {evaluation.modelAnswer}
          </p>
        </div>
      )}

      {evaluation.improvementPlan && (
        <div>
          <SectionLabel>Improvement plan</SectionLabel>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
            {evaluation.improvementPlan}
          </p>
        </div>
      )}

      {evaluation.suggestedResources.length > 0 && (
        <div>
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={12} className="text-mist" /> Resources
            </span>
          </SectionLabel>
          <ul className="space-y-1 text-sm text-signal">
            {evaluation.suggestedResources.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowScores((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-mist transition-colors hover:text-ink"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <ChevronDown size={13} className={cn("transition-transform", showScores && "rotate-180")} />
          {showScores ? "Hide" : "Show"} score breakdown
        </button>
        {showScores && (
          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {SCORE_DIMENSIONS.map(({ key, label }) => (
              <ScoreMeter key={key} label={label} score={Number(evaluation[key])} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
