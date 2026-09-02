/**
 * app/app/interview-lab/components/ReportView.tsx
 *
 * Post-session report: headline score, skill-gap (weak/strong) + roadmap
 * when available, a per-question breakdown reusing EvaluationCard, and
 * downloadable exports (PDF / DOCX / Markdown / JSON).
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, FileJson, FileText, FileType, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvaluationCard } from "./EvaluationCard";
import { ScoreBadge, SectionLabel } from "./primitives";
import { exportUrl } from "../api";
import { interviewTypeLabel } from "../types";
import type { AnsweredItem, ExportFormat, InterviewSession, SkillGap } from "../types";

const PRIORITY_TONE = { high: "pulse", medium: "signal", low: "neutral" } as const;

const EXPORTS: { format: ExportFormat; label: string; icon: typeof FileText }[] = [
  { format: "pdf", label: "PDF", icon: FileType },
  { format: "docx", label: "Word", icon: FileText },
  { format: "markdown", label: "Markdown", icon: FileText },
  { format: "json", label: "JSON", icon: FileJson },
];

export function ReportView({
  session,
  items,
  overallScore,
  skillGap,
  onBack,
  onRestart,
}: {
  session: InterviewSession;
  items: AnsweredItem[];
  overallScore: number;
  skillGap: SkillGap | null;
  onBack: () => void;
  onRestart: () => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-mist transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* headline */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionLabel>Interview report</SectionLabel>
            <p className="text-2xl font-medium text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {session.role}
            </p>
            <p className="mt-1 text-sm text-mist">
              {interviewTypeLabel(session.interviewType)} · {session.seniority}
              {session.company ? ` · ${session.company}` : ""} · {items.length} answered
            </p>
          </div>
          <div className="text-center">
            <ScoreBadge score={overallScore} />
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-mist" style={{ fontFamily: "var(--font-mono)" }}>
              Overall
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {EXPORTS.map(({ format, label, icon: Icon }) => (
            <a
              key={format}
              href={exportUrl(session.id, format)}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-mist transition-colors hover:border-signal hover:text-signal"
            >
              <Icon size={13} /> {label} <Download size={12} />
            </a>
          ))}
        </div>
      </motion.div>

      {/* skill gap */}
      {skillGap && (skillGap.weakSkills.length > 0 || skillGap.strongSkills.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="glass-panel p-5">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <TrendingDown size={12} className="text-danger" /> Focus areas
              </span>
            </SectionLabel>
            {skillGap.weakSkills.length > 0 ? (
              <ul className="space-y-2">
                {skillGap.weakSkills.map((s) => (
                  <li key={s.skill} className="flex items-center justify-between text-sm text-ink/80">
                    {s.skill} <ScoreBadge score={s.score} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mist">No weak areas — solid across the board.</p>
            )}
          </div>
          <div className="glass-panel p-5">
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp size={12} className="text-success" /> Strengths
              </span>
            </SectionLabel>
            {skillGap.strongSkills.length > 0 ? (
              <ul className="space-y-2">
                {skillGap.strongSkills.map((s) => (
                  <li key={s.skill} className="flex items-center justify-between text-sm text-ink/80">
                    {s.skill} <ScoreBadge score={s.score} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mist">Keep practicing to build standout strengths.</p>
            )}
          </div>
        </div>
      )}

      {/* roadmap */}
      {skillGap && skillGap.roadmap.length > 0 && (
        <div className="glass-panel p-5">
          <SectionLabel>Recommended roadmap</SectionLabel>
          <div className="space-y-3">
            {skillGap.roadmap.map((r, i) => (
              <div key={i} className="rounded-xl border border-border bg-ink/[0.02] p-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{r.topic}</span>
                  <Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge>
                </div>
                <p className="text-sm text-mist">{r.reason}</p>
                {r.suggestedActions.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-ink/80">
                    {r.suggestedActions.map((a, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-signal" />
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* per-question breakdown */}
      <div className="space-y-3">
        <SectionLabel>Question breakdown</SectionLabel>
        {items.map((item, i) => (
          <div key={item.question.id} className="glass-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="text-xs text-mist" style={{ fontFamily: "var(--font-mono)" }}>
                Q{i + 1}
              </span>
              <span className="flex-1 truncate text-sm text-ink">{item.question.question}</span>
              <ScoreBadge score={item.evaluation.overallScore} />
            </button>
            {openIndex === i && (
              <div className="space-y-4 border-t border-border p-4">
                <div>
                  <SectionLabel>Your answer</SectionLabel>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{item.answerText}</p>
                </div>
                <EvaluationCard evaluation={item.evaluation} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-2">
        <Button type="button" onClick={onRestart}>
          <RotateCcw size={16} /> Start another interview
        </Button>
      </div>
    </div>
  );
}
