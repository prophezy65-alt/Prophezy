"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Sparkles,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Code2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";

/* ============================================================================
 * Mission-Control theme, same palette as app/app/assignments/page.tsx — dark
 * warm charcoal-brown, coral/amber accents, zero purple. This is a pure UI
 * rebuild of the assignment detail/results view; no backend/API/route
 * changes. Three actions (Regenerate, Export, Run quality check) are wired
 * against my best-informed guess at their real contract, since I've never
 * seen those three route files directly — flagged clearly in chat.
 * ========================================================================== */

const BG = "#1C1512";
const PANEL = "#2A2019";
const CORAL = "#F97316";
const AMBER = "#FBBF24";
const SUCCESS = "#34D399";
const DANGER = "#EF4444";
const INFO = "#38BDF8";
const BORDER = "#4A3B2C";
const TEXT = "#F3E9DC";
const SUBTEXT = "#B2A08C";

const DEPTH_MODES = [
  { value: "simple", label: "Simple" },
  { value: "standard", label: "Standard" },
  { value: "technical", label: "Technical" },
] as const;
type DepthMode = (typeof DEPTH_MODES)[number]["value"];

const EXPORT_FORMATS = ["pdf", "docx", "markdown", "json", "csv", "html"] as const;

interface Question {
  id: string;
  questionNumber: string;
  rawText: string;
  cleanedText: string;
  type: string;
  marks: number | null;
  difficulty: string;
  subject: string;
  topic: string;
  mcqOptions: string[] | null;
}

interface SolutionStep {
  stepNumber: number;
  title: string;
  explanation: string;
  formula?: string;
  code?: string;
  codeLanguage?: string;
}

interface Solution {
  explanationOfQuestion: string;
  approach: string;
  steps: SolutionStep[];
  finalAnswer: string;
  keyConcepts: string[];
  mermaidDiagrams: string[];
  pseudocode: string | null;
  code: { language: string; content: string } | null;
  references: { citationText: string }[];
  glossary: { term: string; definition: string }[];
}

interface DocumentDetail {
  summary: { id: string; title: string; subject?: string | null; detectedSubjectArea?: string | null; questionCount?: number; status?: string };
  questions: Question[];
  solutions: Record<string, Partial<Record<DepthMode, Solution>>>;
}

const DIFFICULTY_COLOR: Record<string, string> = { easy: SUCCESS, medium: INFO, hard: AMBER, expert: DANGER };

export default function AssignmentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [depthByQuestion, setDepthByQuestion] = useState<Record<string, DepthMode>>({});
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  const [exportFormat, setExportFormat] = useState<(typeof EXPORT_FORMATS)[number]>("pdf");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [qualityChecking, setQualityChecking] = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [qualityResult, setQualityResult] = useState<{ suggestions?: string[]; issues?: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/assignment/${documentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load this assignment.");
      setDetail(data);
      if (data.questions?.[0]) setExpanded(new Set([data.questions[0].id]));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load this assignment.");
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function depthFor(questionId: string): DepthMode {
    return depthByQuestion[questionId] ?? "standard";
  }

  async function handleDelete() {
    if (!confirm("Delete this assignment? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/assignment/${documentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete.");
      router.push("/app/assignments");
    } catch {
      alert("Failed to delete — please try again.");
    }
  }

  // Best-effort against README's listed route:
  // assignment/[documentId]/questions/[questionId]/solution/route.ts
  async function handleRegenerate(questionId: string, depth: DepthMode) {
    setRegenerating((prev) => new Set(prev).add(questionId));
    try {
      const res = await fetch(`/api/assignment/${documentId}/questions/${questionId}/solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depthMode: depth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to regenerate.");
      setDetail((prev) =>
        prev
          ? { ...prev, solutions: { ...prev.solutions, [questionId]: { ...prev.solutions[questionId], [depth]: data.solution ?? data } } }
          : prev
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to regenerate this solution.");
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(questionId);
        return next;
      });
    }
  }

  // Best-effort against README's listed route: assignment/[documentId]/export/route.ts
  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/assignment/${documentId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: exportFormat }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail?.summary.title ?? "assignment"}.${exportFormat === "markdown" ? "md" : exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  // Best-effort against README's listed route: assignment/[documentId]/quality-check/route.ts
  async function handleQualityCheck() {
    setQualityChecking(true);
    setQualityError(null);
    try {
      const res = await fetch(`/api/assignment/${documentId}/quality-check`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Quality check failed.");
      setQualityResult(data);
    } catch (err) {
      setQualityError(err instanceof Error ? err.message : "Quality check failed.");
    } finally {
      setQualityChecking(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-[28px] p-8" style={{ backgroundColor: BG, minHeight: "100%" }}>
        <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: `${DANGER}40`, backgroundColor: `${DANGER}12`, color: DANGER }}>
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle size={15} /> {loadError}
          </div>
          <button onClick={load} className="text-xs font-semibold underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center gap-2 rounded-[28px] p-8 text-sm" style={{ backgroundColor: BG, color: SUBTEXT, minHeight: "100%" }}>
        <Loader2 size={14} className="animate-spin" /> Loading…
      </div>
    );
  }

  const { summary, questions } = detail;
  const subjectLabel = summary.subject || summary.detectedSubjectArea || "General";

  return (
    <div className="rounded-[28px] border p-6 sm:p-8" style={{ backgroundColor: BG, borderColor: BORDER, minHeight: "100%", boxShadow: "0 24px 60px -30px rgba(0,0,0,0.5)" }}>
      <Link href="/app/assignments" className="mb-4 flex w-fit items-center gap-1.5 text-xs" style={{ color: SUBTEXT }}>
        <ArrowLeft size={14} /> All assignments
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: TEXT, letterSpacing: "-0.02em" }}>
            {summary.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: SUBTEXT }}>
            <span style={{ color: CORAL }}>{subjectLabel}</span>
            <span>·</span>
            {questions.length} questions
            {summary.status && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ backgroundColor: `${SUCCESS}18`, color: SUCCESS }}>
                {summary.status}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
          style={{ borderColor: BORDER, color: SUBTEXT }}
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* Quality check */}
      <div className="mb-4 rounded-3xl border p-5" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: TEXT }}>
            <Sparkles size={15} style={{ color: AMBER }} /> AI improvement suggestions
          </span>
          <button
            onClick={handleQualityCheck}
            disabled={qualityChecking}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: `${AMBER}20`, color: AMBER }}
          >
            {qualityChecking ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
            {qualityChecking ? "Checking…" : "Run quality check"}
          </button>
        </div>
        {qualityError && <p className="mt-3 text-xs" style={{ color: DANGER }}>{qualityError}</p>}
        {qualityResult && (
          <ul className="mt-3 flex flex-col gap-1.5 text-xs" style={{ color: SUBTEXT }}>
            {[...(qualityResult.issues ?? []), ...(qualityResult.suggestions ?? [])].map((s, i) => (
              <li key={i} className="rounded-xl border px-3 py-2" style={{ borderColor: BORDER }}>
                {s}
              </li>
            ))}
            {(qualityResult.issues?.length ?? 0) + (qualityResult.suggestions?.length ?? 0) === 0 && <li>No issues found.</li>}
          </ul>
        )}
      </div>

      {/* Export */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border p-5" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: TEXT }}>
          <Download size={15} style={{ color: INFO }} /> Export
        </span>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
            className="h-10 rounded-xl border px-3 text-xs"
            style={{ borderColor: BORDER, backgroundColor: "#221A14", color: TEXT }}
          >
            {EXPORT_FORMATS.map((f) => (
              <option key={f} value={f} style={{ backgroundColor: PANEL }}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: CORAL }}
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
      {exportError && <p className="-mt-3 mb-6 text-xs" style={{ color: DANGER }}>{exportError}</p>}

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const isOpen = expanded.has(q.id);
          const depth = depthFor(q.id);
          const solution = detail.solutions[q.id]?.[depth];
          const diffColor = DIFFICULTY_COLOR[q.difficulty] ?? SUBTEXT;

          return (
            <div key={q.id} className="rounded-3xl border p-5" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <button onClick={() => toggleExpanded(q.id)} className="flex w-full items-start justify-between gap-3 text-left">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: `${CORAL}20`, color: CORAL }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: TEXT }}>
                      {q.cleanedText || q.rawText}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Tag color={diffColor} label={q.difficulty} />
                      <Tag color={INFO} label={q.type} />
                      <Tag color={SUBTEXT} label={q.topic || q.subject} />
                    </div>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={16} style={{ color: SUBTEXT }} /> : <ChevronDown size={16} style={{ color: SUBTEXT }} />}
              </button>

              {isOpen && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: BORDER }}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: BORDER }}>
                      {DEPTH_MODES.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setDepthByQuestion((prev) => ({ ...prev, [q.id]: d.value }))}
                          className="px-3.5 py-2 text-xs font-medium"
                          style={{ backgroundColor: depth === d.value ? CORAL : "transparent", color: depth === d.value ? "#fff" : SUBTEXT }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleRegenerate(q.id, depth)}
                      disabled={regenerating.has(q.id)}
                      className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium disabled:opacity-50"
                      style={{ borderColor: BORDER, color: SUBTEXT }}
                    >
                      {regenerating.has(q.id) ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Regenerate
                    </button>
                  </div>

                  {!solution ? (
                    <button
                      onClick={() => handleRegenerate(q.id, depth)}
                      disabled={regenerating.has(q.id)}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: CORAL }}
                    >
                      {regenerating.has(q.id) ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      Generate {depth} solution
                    </button>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {solution.approach && (
                        <div>
                          <SectionLabel icon={<BookOpen size={12} />} text="Approach" color={INFO} />
                          <p className="text-sm leading-relaxed" style={{ color: SUBTEXT }}>
                            {solution.approach}
                          </p>
                        </div>
                      )}

                      {solution.steps?.map((step) => (
                        <div key={step.stepNumber} className="rounded-2xl border p-4" style={{ borderColor: BORDER, backgroundColor: "#221A14" }}>
                          <p className="mb-1.5 text-xs font-semibold" style={{ color: CORAL }}>
                            Step {step.stepNumber}: {step.title}
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: TEXT }}>
                            {step.explanation}
                          </p>
                          {step.formula && (
                            <p className="mt-2 rounded-lg px-3 py-2 font-mono text-xs" style={{ backgroundColor: BG, color: AMBER }}>
                              {step.formula}
                            </p>
                          )}
                          {step.code && (
                            <pre className="mt-2 overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs" style={{ backgroundColor: BG, color: SUCCESS }}>
                              {step.code}
                            </pre>
                          )}
                        </div>
                      ))}

                      {solution.finalAnswer && (
                        <div className="rounded-2xl border p-4" style={{ borderColor: `${SUCCESS}40`, backgroundColor: `${SUCCESS}0f` }}>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: SUCCESS }}>
                            Final answer
                          </p>
                          <p className="text-sm font-medium" style={{ color: TEXT }}>
                            {solution.finalAnswer}
                          </p>
                        </div>
                      )}

                      {solution.code && (
                        <div>
                          <SectionLabel icon={<Code2 size={12} />} text={solution.code.language} color={SUCCESS} />
                          <pre className="overflow-x-auto rounded-2xl border p-4 font-mono text-xs" style={{ borderColor: BORDER, backgroundColor: "#221A14", color: TEXT }}>
                            {solution.code.content}
                          </pre>
                        </div>
                      )}

                      {solution.keyConcepts?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {solution.keyConcepts.map((c) => (
                            <Tag key={c} color={CORAL} label={c} />
                          ))}
                        </div>
                      )}

                      {solution.glossary?.length > 0 && (
                        <div>
                          <SectionLabel icon={<BookOpen size={12} />} text="Glossary" color={AMBER} />
                          <div className="flex flex-col gap-2">
                            {solution.glossary.map((g) => (
                              <p key={g.term} className="text-xs" style={{ color: SUBTEXT }}>
                                <span className="font-semibold" style={{ color: TEXT }}>
                                  {g.term}:
                                </span>{" "}
                                {g.definition}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {solution.references?.length > 0 && (
                        <div>
                          <SectionLabel icon={<BookOpen size={12} />} text="References" color={INFO} />
                          <div className="flex flex-col gap-1">
                            {solution.references.map((r, idx) => (
                              <p key={idx} className="text-xs" style={{ color: SUBTEXT }}>
                                {r.citationText}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ color, label }: { color: string; label: string }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: `${color}18`, color }}>
      {label}
    </span>
  );
}

function SectionLabel({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
      {icon} {text}
    </p>
  );
}
