"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DetectedQuestion, ExportFormat, QualityReport, QuestionSolution } from "@/lib/assignment/models/types";
import type { ExplanationDepth } from "@/lib/assignment/services/generator.service";
import type { DocumentDetail } from "@/lib/assignment-db/repository";

interface AssignmentDetailProps {
  documentId: string;
  initialDetail: DocumentDetail;
}

const DEPTH_MODES: { value: ExplanationDepth; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "standard", label: "Standard" },
  { value: "technical", label: "Technical" },
];

const DIFFICULTY_TONE: Record<string, "signal" | "success" | "pulse" | "neutral"> = {
  easy: "success",
  medium: "signal",
  hard: "pulse",
  expert: "pulse",
};

const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV" },
];

export function AssignmentDetail({ documentId, initialDetail }: AssignmentDetailProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<DocumentDetail>(initialDetail);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(initialDetail.questions[0]?.id ?? null);
  const [deleting, setDeleting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);

  function updateSolution(questionId: string, depth: ExplanationDepth, solution: QuestionSolution) {
    setDetail((prev) => ({
      ...prev,
      solutions: {
        ...prev.solutions,
        [questionId]: { ...prev.solutions[questionId], [depth]: solution },
      },
    }));
  }

  async function handleDelete() {
    if (!confirm("Delete this assignment and all its generated solutions? This can't be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/assignment/${documentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      router.push("/app/assignments");
    } catch {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/assignment/${documentId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat, includeSolutions: true, includeReferences: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(data.message ?? data.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] ?? `${detail.summary.title}.${exportFormat}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleQualityCheck() {
    setQualityLoading(true);
    setQualityError(null);
    try {
      const res = await fetch(`/api/assignment/${documentId}/quality-check`, { method: "POST" });
      const data = (await res.json()) as { report?: QualityReport; message?: string; error?: string };
      if (!res.ok || !data.report) throw new Error(data.message ?? data.error ?? "Quality check failed");
      setQualityReport(data.report);
    } catch (err) {
      setQualityError(err instanceof Error ? err.message : "Quality check failed");
    } finally {
      setQualityLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href="/app/assignments" className="inline-flex items-center gap-1.5 text-sm text-mist hover:text-ink">
        <ArrowLeft size={15} /> All assignments
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink">{detail.summary.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-mist">
            <span>{detail.summary.subject || detail.summary.detectedSubjectArea || "General"}</span>
            <span>·</span>
            <span>
              {detail.questions.length} question{detail.questions.length === 1 ? "" : "s"}
            </span>
            <Badge tone={detail.summary.status === "ready" ? "success" : "pulse"}>{detail.summary.status}</Badge>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-mist transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Delete
        </button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-signal" />
            <h2 className="font-display text-sm font-medium text-ink">AI improvement suggestions</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={handleQualityCheck} disabled={qualityLoading}>
            {qualityLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Checking…
              </>
            ) : (
              "Run quality check"
            )}
          </Button>
        </div>

        {qualityError && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
            <TriangleAlert size={13} /> {qualityError}
          </p>
        )}

        {qualityReport && <QualityReportView report={qualityReport} />}
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-sm font-medium text-ink">Export</h2>
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="h-9 rounded-lg border border-border bg-surface/40 px-3 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export
            </Button>
          </div>
        </div>
        {exportError && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
            <TriangleAlert size={13} /> {exportError}
          </p>
        )}
      </Card>

      <div className="space-y-3">
        {detail.questions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-12 text-center">
            <BookOpen size={24} className="text-mist" />
            <p className="text-sm text-mist">No questions were detected in this document.</p>
          </Card>
        ) : (
          detail.questions.map((question, i) => (
            <QuestionCard
              key={question.id}
              documentId={documentId}
              index={i}
              question={question}
              solutionsByDepth={detail.solutions[question.id] ?? {}}
              expanded={expandedQuestionId === question.id}
              onToggle={() => setExpandedQuestionId((prev) => (prev === question.id ? null : question.id))}
              onSolution={(depth, solution) => updateSolution(question.id, depth, solution)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  documentId,
  index,
  question,
  solutionsByDepth,
  expanded,
  onToggle,
  onSolution,
}: {
  documentId: string;
  index: number;
  question: DetectedQuestion;
  solutionsByDepth: Partial<Record<ExplanationDepth, QuestionSolution>>;
  expanded: boolean;
  onToggle: () => void;
  onSolution: (depth: ExplanationDepth, solution: QuestionSolution) => void;
}) {
  const [depth, setDepth] = useState<ExplanationDepth>("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSolution = solutionsByDepth[depth] ?? null;

  async function generate(forceRefresh: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assignment/${documentId}/questions/${question.id}/solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depthMode: depth, forceRefresh }),
      });
      const data = (await res.json()) as { solution?: QuestionSolution; message?: string; error?: string };
      if (!res.ok || !data.solution) throw new Error(data.message ?? data.error ?? "Failed to generate solution");
      onSolution(depth, data.solution);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate solution");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <button onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/5 text-xs font-medium text-mist">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink">{question.cleanedText}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={DIFFICULTY_TONE[question.difficulty] ?? "neutral"}>{question.difficulty}</Badge>
              <Badge tone="neutral">{question.type.replace(/_/g, " ")}</Badge>
              {question.marks !== null && <Badge tone="neutral">{question.marks} marks</Badge>}
              {question.topic && <Badge tone="neutral">{question.topic}</Badge>}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="mt-1 shrink-0 text-mist" /> : <ChevronDown size={16} className="mt-1 shrink-0 text-mist" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {DEPTH_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setDepth(mode.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  depth === mode.value ? "bg-signal text-white" : "bg-ink/5 text-mist hover:bg-ink/10",
                )}
              >
                {mode.label}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              {currentSolution && (
                <Button variant="ghost" size="sm" onClick={() => generate(true)} disabled={loading}>
                  <RefreshCw size={13} /> Regenerate
                </Button>
              )}
              {!currentSolution && (
                <Button size="sm" onClick={() => generate(false)} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Solving…
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} /> Solve
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <TriangleAlert size={13} /> {error}
            </p>
          )}
          {loading && !currentSolution && (
            <div className="space-y-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-ink/5" />
              <div className="h-3 w-full animate-pulse rounded bg-ink/5" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-ink/5" />
            </div>
          )}

          {currentSolution && <SolutionView solution={currentSolution} />}
        </div>
      )}
    </Card>
  );
}

function SolutionView({ solution }: { solution: QuestionSolution }) {
  return (
    <div className="space-y-4 text-sm text-ink">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-mist">Approach</p>
        <p className="mt-1 leading-relaxed">{solution.approach}</p>
      </div>

      <div className="space-y-3">
        {solution.steps.map((step) => (
          <div key={step.stepNumber} className="rounded-xl border border-border/60 bg-ink/[0.02] p-3">
            <p className="text-xs font-medium text-signal">
              Step {step.stepNumber}: {step.title}
            </p>
            <p className="mt-1 leading-relaxed text-ink/90">{step.explanation}</p>
            {step.formula && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/5 p-2 font-mono text-xs">{step.formula}</pre>
            )}
            {step.code && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/5 p-2 font-mono text-xs">{step.code}</pre>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-success/30 bg-success/5 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-success">Final answer</p>
        <p className="mt-1 leading-relaxed">{solution.finalAnswer}</p>
      </div>

      {solution.keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {solution.keyConcepts.map((concept) => (
            <Badge key={concept} tone="signal">
              {concept}
            </Badge>
          ))}
        </div>
      )}

      {solution.mermaidDiagrams.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Diagram</p>
          {solution.mermaidDiagrams.map((diagram, i) => (
            <pre key={i} className="mt-1 overflow-x-auto rounded-lg bg-ink/5 p-2 font-mono text-xs">
              {diagram}
            </pre>
          ))}
        </div>
      )}

      {solution.glossary.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Glossary</p>
          <dl className="mt-1 space-y-1">
            {solution.glossary.map((entry) => (
              <div key={entry.term} className="text-xs">
                <dt className="inline font-medium text-ink">{entry.term}: </dt>
                <dd className="inline text-mist">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {solution.references.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">References</p>
          <ul className="mt-1 space-y-1 text-xs text-mist">
            {solution.references.map((ref) => (
              <li key={ref.id}>{ref.citationText}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QualityReportView({ report }: { report: QualityReport }) {
  const totalIssues =
    report.grammarIssues.length + report.citationIssues.length + report.duplicateMatches.length + report.consistencyIssues.length;

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-mist">
          Tone: {report.toneAssessment.detectedTone}
        </p>
        <Badge tone={totalIssues === 0 ? "success" : "pulse"}>
          {totalIssues === 0 ? "No issues found" : `${totalIssues} suggestion${totalIssues === 1 ? "" : "s"}`}
        </Badge>
      </div>

      {report.toneAssessment.suggestions.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-mist">
          {report.toneAssessment.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}

      {report.grammarIssues.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink">Grammar &amp; style</p>
          <ul className="mt-1 space-y-1 text-xs text-mist">
            {report.grammarIssues.map((issue, i) => (
              <li key={i}>
                &ldquo;{issue.originalText}&rdquo; → &ldquo;{issue.suggestion}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.citationIssues.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink">Citations</p>
          <ul className="mt-1 space-y-1 text-xs text-mist">
            {report.citationIssues.map((issue, i) => (
              <li key={i}>{issue.issue}</li>
            ))}
          </ul>
        </div>
      )}

      {report.duplicateMatches.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink">Possible duplicate content</p>
          <p className="mt-1 text-xs text-mist">
            {report.duplicateMatches.length} pair(s) of questions have similar answers — worth a manual look.
          </p>
        </div>
      )}

      <p className="text-[11px] italic text-mist">{report.plagiarismAwarenessNote}</p>
    </div>
  );
}
