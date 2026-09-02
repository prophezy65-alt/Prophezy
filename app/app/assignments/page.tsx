"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Upload,
  ClipboardPaste,
  Search,
  Loader2,
  Sparkles,
  Trash2,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  LayoutGrid,
  Kanban as KanbanIcon,
  ListChecks,
  Flame,
} from "lucide-react";

/* ============================================================================
 * Mission-Control theme — scoped entirely to this page. Deliberately far
 * from Study Hub's dark UI: warm light background, white floating panels,
 * coral/amber accents. Nothing here touches the shared OS shell (sidebar /
 * topbar / right panel), backend, API contracts, or data shapes — this file
 * only changes how the exact same fetch/upload/paste/delete calls are
 * rendered.
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

const DIFFICULTIES = [
  { value: "", label: "Any", color: SUBTEXT },
  { value: "easy", label: "Easy", color: SUCCESS },
  { value: "medium", label: "Medium", color: INFO },
  { value: "hard", label: "Hard", color: AMBER },
  { value: "expert", label: "Expert", color: DANGER },
] as const;

const SUBJECT_PALETTE = [CORAL, INFO, AMBER, SUCCESS, "#0D9488", "#FB7185"];
function colorForSubject(subject: string): string {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length]!;
}

interface DocumentSummary {
  id: string;
  title: string;
  subject?: string | null;
  detectedSubjectArea?: string | null;
  questionCount?: number;
  status?: string;
  createdAt?: string;
}

/** Counts up from 0 to `value` on mount/change — purely cosmetic, no data
 * dependency beyond the real number it's given. */
function useCountUp(value: number, durationMs = 700): number {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const from = 0;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

export default function AssignmentsPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [view, setView] = useState<"grid" | "kanban">("grid");

  const loadDocuments = useCallback(async () => {
    setListError(null);
    try {
      const params = new URLSearchParams({ page: "0", pageSize: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (difficulty) params.set("difficulty", difficulty);
      const res = await fetch(`/api/assignment?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load assignments.");
      setDocuments(data.documents ?? []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load assignments.");
    }
  }, [search, difficulty]);

  useEffect(() => {
    const t = setTimeout(loadDocuments, 300);
    return () => clearTimeout(t);
  }, [loadDocuments]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setSubmitError("Choose a file first.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = new FormData();
      body.append("files", file);
      if (subject.trim()) body.append("subject", subject.trim());
      const res = await fetch("/api/assignment/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Upload failed.");
      const first = data.documents?.[0];
      if (first?.id) router.push(`/app/assignments/${first.id}`);
      else loadDocuments();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasteSolve(e: React.FormEvent) {
    e.preventDefault();
    if (pastedText.trim().length < 5) {
      setSubmitError("Paste in the question text first.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/assignment/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText.trim(), subject: subject.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to solve.");
      router.push(`/app/assignments/${data.document.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to solve.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this assignment? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/assignment/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete.");
      setDocuments((prev) => prev?.filter((d) => d.id !== id) ?? prev);
    } catch {
      loadDocuments();
    }
  }

  // ---- real, derived-only stats (no fabricated data) -------------------------
  const stats = useMemo(() => {
    const docs = documents ?? [];
    const totalQuestions = docs.reduce((sum, d) => sum + (d.questionCount ?? 0), 0);
    const ready = docs.filter((d) => d.status === "ready").length;
    const processing = docs.filter((d) => d.status === "processing").length;
    return { total: docs.length, totalQuestions, ready, processing };
  }, [documents]);

  // Real upload-activity heatmap: counts documents by their actual createdAt
  // date, last 14 days. No fabricated engagement data — purely a
  // visualization of real timestamps already in the list response.
  const heatmap = useMemo(() => {
    const days: { date: string; count: number }[] = [];
    const counts = new Map<string, number>();
    for (const d of documents ?? []) {
      if (!d.createdAt) continue;
      const key = new Date(d.createdAt).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (let i = 13; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      days.push({ date: key, count: counts.get(key) ?? 0 });
    }
    return days;
  }, [documents]);

  const maxHeat = Math.max(1, ...heatmap.map((d) => d.count));

  return (
    <div className="rounded-[28px] border p-6 sm:p-8" style={{ backgroundColor: BG, minHeight: "100%", borderColor: BORDER, boxShadow: "0 24px 60px -30px rgba(17,24,39,0.35)" }}>
      <style>{`
        @keyframes af-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .af-skeleton { background: linear-gradient(90deg, #241B15 25%, #332619 37%, #241B15 63%); background-size: 800px 100%; animation: af-shimmer 1.4s ease-in-out infinite; }
        @keyframes af-pop { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .af-pop { animation: af-pop 0.35s ease-out; }
        .af-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .af-card:hover { transform: translateY(-3px); box-shadow: 0 20px 40px -14px rgba(17,24,39,0.22); }
        .af-btn { transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease; }
        .af-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px -8px rgba(249,115,22,0.45); }
        .af-btn:active { transform: translateY(0); }
        @keyframes af-spin-slow { to { transform: rotate(360deg); } }
        .af-spin-slow { animation: af-spin-slow 1.8s linear infinite; }
      `}</style>

      {/* ---- Header ---- */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: CORAL }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CORAL, boxShadow: `0 0 0 4px ${CORAL}22` }} />
            Assignment Command Center
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: TEXT, letterSpacing: "-0.02em" }}>
            Assignments
          </h1>
          <p className="mt-1 max-w-xl text-sm" style={{ color: SUBTEXT }}>
            Upload or paste a question and get step-by-step AI solutions — exportable to PDF, DOCX, or Markdown.
          </p>
        </div>

        <div className="flex overflow-hidden rounded-2xl border" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
          <button
            onClick={() => setView("grid")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium"
            style={{ backgroundColor: view === "grid" ? "#111827" : "transparent", color: view === "grid" ? "#fff" : SUBTEXT }}
          >
            <LayoutGrid size={14} /> Grid
          </button>
          <button
            onClick={() => setView("kanban")}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium"
            style={{ backgroundColor: view === "kanban" ? "#111827" : "transparent", color: view === "kanban" ? "#fff" : SUBTEXT }}
          >
            <KanbanIcon size={14} /> Board
          </button>
        </div>
      </div>

      {/* ---- Real stat cards ---- */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<FileText size={16} />} color={CORAL} label="Assignments" value={stats.total} loading={documents === null} />
        <StatCard icon={<ListChecks size={16} />} color={INFO} label="Total questions" value={stats.totalQuestions} loading={documents === null} />
        <StatCard icon={<CheckCircle2 size={16} />} color={SUCCESS} label="Ready" value={stats.ready} loading={documents === null} />
        <StatCard icon={<Clock size={16} />} color={AMBER} label="Processing" value={stats.processing} loading={documents === null} />
      </div>

      {/* ---- Upload activity heatmap (real dates) ---- */}
      {documents !== null && documents.length > 0 && (
        <div className="mb-6 rounded-3xl border p-5 af-pop" style={{ borderColor: BORDER, backgroundColor: PANEL, boxShadow: "0 2px 6px rgba(17,24,39,0.06), 0 10px 24px -14px rgba(17,24,39,0.16)" }}>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold" style={{ color: TEXT }}>
            <Flame size={14} style={{ color: CORAL }} />
            Upload activity — last 14 days
          </div>
          <div className="flex items-end gap-1.5">
            {heatmap.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count} uploaded`}>
                <div
                  className="w-full rounded-md"
                  style={{
                    height: 28,
                    backgroundColor: d.count === 0 ? "#F1F3F6" : CORAL,
                    opacity: d.count === 0 ? 1 : 0.35 + 0.65 * (d.count / maxHeat),
                  }}
                />
                <span className="text-[9px]" style={{ color: SUBTEXT }}>
                  {new Date(d.date).getDate()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Upload / Paste panel ---- */}
      <div
        className="mb-6 rounded-3xl border p-6 af-pop"
        style={{ borderColor: BORDER, backgroundColor: PANEL, boxShadow: "0 2px 6px rgba(17,24,39,0.07), 0 16px 36px -18px rgba(17,24,39,0.2)" }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: TEXT }}>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${CORAL}18`, color: CORAL }}
            >
              <FileText size={16} />
            </span>
            New assignment
          </div>
          <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: BORDER }}>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium"
              style={{ backgroundColor: mode === "upload" ? CORAL : "transparent", color: mode === "upload" ? "#fff" : SUBTEXT }}
            >
              <Upload size={13} /> Upload
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium"
              style={{ backgroundColor: mode === "paste" ? CORAL : "transparent", color: mode === "paste" ? "#fff" : SUBTEXT }}
            >
              <ClipboardPaste size={13} /> Paste
            </button>
          </div>
        </div>

        {mode === "upload" ? (
          <form onSubmit={handleUpload}>
            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) setFile(dropped);
                }}
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm"
                style={{
                  borderColor: dragOver ? CORAL : BORDER,
                  backgroundColor: dragOver ? `${CORAL}0a` : "#221A14",
                  color: SUBTEXT,
                }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${CORAL}15`, color: CORAL }}
                >
                  <Upload size={18} />
                </span>
                <span style={{ color: TEXT }} className="font-medium">
                  Click to choose a file, or drag it here
                </span>
                <span className="text-xs" style={{ color: SUBTEXT }}>
                  PDF, DOCX, TXT, Markdown, images, ZIP, PPTX — up to 50MB each
                </span>
              </button>
            ) : (
              <div className="flex h-14 items-center justify-between rounded-2xl border px-4" style={{ borderColor: BORDER, backgroundColor: "#221A14" }}>
                <span className="flex items-center gap-2 truncate text-sm" style={{ color: TEXT }}>
                  <FileText size={16} style={{ color: CORAL }} className="shrink-0" />
                  <span className="truncate">{file.name}</span>
                </span>
                <button type="button" onClick={() => setFile(null)} className="shrink-0" style={{ color: SUBTEXT }}>
                  <X size={16} />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (optional — e.g. Thermodynamics)"
                className="h-12 flex-1 rounded-2xl border px-4 text-sm focus:outline-none"
                style={{ borderColor: BORDER, color: TEXT, backgroundColor: "#221A14" }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="af-btn flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: CORAL, boxShadow: "0 6px 16px -6px rgba(249,115,22,0.5)" }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {submitting ? "Uploading & solving…" : "Upload & Solve"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasteSolve}>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste one or more questions here — e.g. 'Explain the difference between TCP and UDP.'"
              rows={5}
              className="w-full rounded-2xl border p-4 text-sm focus:outline-none"
              style={{ borderColor: BORDER, color: TEXT, backgroundColor: "#221A14" }}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (optional — e.g. Computer Networks)"
                className="h-12 flex-1 rounded-2xl border px-4 text-sm focus:outline-none"
                style={{ borderColor: BORDER, color: TEXT, backgroundColor: "#221A14" }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="af-btn flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: CORAL, boxShadow: "0 6px 16px -6px rgba(249,115,22,0.5)" }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {submitting ? "Solving…" : "Solve"}
              </button>
            </div>
          </form>
        )}

        {submitError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: `${DANGER}10`, color: DANGER }}>
            <AlertTriangle size={14} className="shrink-0" />
            {submitError}
          </div>
        )}
      </div>

      {/* ---- Search + difficulty filters ---- */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: SUBTEXT }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by subject"
            className="h-11 w-full rounded-2xl border pl-10 pr-4 text-sm focus:outline-none"
            style={{ borderColor: BORDER, color: TEXT, backgroundColor: PANEL }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              onClick={() => setDifficulty(d.value)}
              className="rounded-full border px-3.5 py-2 text-xs font-medium transition-colors"
              style={{
                borderColor: difficulty === d.value ? d.color : BORDER,
                backgroundColor: difficulty === d.value ? `${d.color}15` : PANEL,
                color: difficulty === d.value ? d.color : SUBTEXT,
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- List states ---- */}
      {listError && (
        <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: `${DANGER}30`, backgroundColor: `${DANGER}08`, color: DANGER }}>
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle size={15} /> {listError}
          </div>
          <button onClick={loadDocuments} className="text-xs font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!listError && documents === null && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-3xl border p-5" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="af-skeleton mb-3 h-4 w-3/4 rounded-lg" />
              <div className="af-skeleton mb-4 h-3 w-1/2 rounded-lg" />
              <div className="af-skeleton h-9 w-28 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {!listError && documents !== null && documents.length === 0 && (
        <div
          className="flex flex-col items-center gap-3 rounded-3xl border px-6 py-16 text-center af-pop"
          style={{ borderColor: BORDER, backgroundColor: PANEL }}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${CORAL}15`, color: CORAL }}
          >
            <FileText size={26} />
          </span>
          <p className="text-base font-semibold" style={{ color: TEXT }}>
            No assignments yet
          </p>
          <p className="max-w-sm text-sm" style={{ color: SUBTEXT }}>
            Upload a document or paste a question above and Assignment AI will detect every question and generate
            step-by-step solutions.
          </p>
        </div>
      )}

      {!listError && documents !== null && documents.length > 0 && view === "grid" && (
        <div className="flex flex-wrap gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]">
              <AssignmentCard doc={doc} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}

      {!listError && documents !== null && documents.length > 0 && view === "kanban" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KanbanColumn title="Processing" color={AMBER} icon={<Clock size={13} />} docs={documents.filter((d) => d.status === "processing")} onDelete={handleDelete} />
          <KanbanColumn title="Ready" color={SUCCESS} icon={<CheckCircle2 size={13} />} docs={documents.filter((d) => d.status === "ready")} onDelete={handleDelete} />
          <KanbanColumn title="Failed" color={DANGER} icon={<AlertTriangle size={13} />} docs={documents.filter((d) => d.status !== "ready" && d.status !== "processing")} onDelete={handleDelete} />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, color, label, value, loading }: { icon: React.ReactNode; color: string; label: string; value: number; loading: boolean }) {
  const display = useCountUp(value);
  return (
    <div
      className="af-card af-pop rounded-3xl border p-4"
      style={{ borderColor: BORDER, backgroundColor: PANEL, boxShadow: "0 2px 6px rgba(17,24,39,0.06), 0 10px 24px -14px rgba(17,24,39,0.16)" }}
    >
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
        {icon}
      </div>
      {loading ? (
        <div className="af-skeleton h-7 w-12 rounded-lg" />
      ) : (
        <div className="text-2xl font-bold" style={{ color: TEXT, letterSpacing: "-0.02em" }}>
          {display}
        </div>
      )}
      <div className="mt-0.5 text-xs" style={{ color: SUBTEXT }}>
        {label}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const config =
    status === "ready"
      ? { color: SUCCESS, label: "Ready", icon: <CheckCircle2 size={11} /> }
      : status === "processing"
        ? { color: AMBER, label: "Processing", icon: <Clock size={11} className="af-spin-slow" /> }
        : { color: DANGER, label: status ?? "Failed", icon: <AlertTriangle size={11} /> };
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${config.color}15`, color: config.color }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function AssignmentCard({ doc, onDelete }: { doc: DocumentSummary; onDelete: (id: string) => void }) {
  const subjectLabel = doc.subject || doc.detectedSubjectArea || "General";
  const subjectColor = colorForSubject(subjectLabel);
  const isReady = doc.status === "ready";

  return (
    <div
      className="af-card af-pop group flex flex-col gap-3 overflow-hidden rounded-3xl border p-5"
      style={{ borderColor: BORDER, backgroundColor: PANEL, boxShadow: "0 2px 6px rgba(17,24,39,0.06), 0 10px 24px -14px rgba(17,24,39,0.16)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${subjectColor}18` }}>
            <FileText size={18} style={{ color: subjectColor }} />
            {isReady && (
              <span
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2"
                style={{ backgroundColor: SUCCESS, borderColor: PANEL }}
              >
                <CheckCircle2 size={9} color="#fff" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: TEXT }} title={doc.title}>
              {doc.title}
            </p>
            <p className="text-xs" style={{ color: subjectColor }}>
              {subjectLabel}
            </p>
          </div>
        </div>
        <StatusPill status={doc.status} />
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: SUBTEXT }}>
        <span className="flex items-center gap-1">
          <ListChecks size={12} /> {doc.questionCount ?? 0} question{doc.questionCount === 1 ? "" : "s"}
        </span>
        {doc.createdAt && (
          <span className="flex items-center gap-1">
            <Clock size={12} /> {new Date(doc.createdAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <Link
          href={`/app/assignments/${doc.id}`}
          className="af-btn rounded-xl px-4 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: "#111827" }}
        >
          Continue working
        </Link>
        <button
          onClick={() => onDelete(doc.id)}
          className="rounded-lg p-2 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: SUBTEXT }}
          onMouseEnter={(e) => (e.currentTarget.style.color = DANGER)}
          onMouseLeave={(e) => (e.currentTarget.style.color = SUBTEXT)}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  color,
  icon,
  docs,
  onDelete,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  docs: DocumentSummary[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: BORDER, backgroundColor: "#221A14" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          {icon} {title}
        </span>
        <span
          className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {docs.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {docs.length === 0 && (
          <p className="rounded-xl border border-dashed px-3 py-6 text-center text-xs" style={{ borderColor: BORDER, color: SUBTEXT }}>
            Nothing here
          </p>
        )}
        {docs.map((doc) => (
          <div key={doc.id} className="af-card rounded-2xl border p-3" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <p className="truncate text-xs font-semibold" style={{ color: TEXT }}>
              {doc.title}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: SUBTEXT }}>
              {doc.subject || doc.detectedSubjectArea || "General"} · {doc.questionCount ?? 0}q
            </p>
            <div className="mt-2 flex items-center justify-between">
              <Link href={`/app/assignments/${doc.id}`} className="text-[11px] font-semibold" style={{ color: CORAL }}>
                Open →
              </Link>
              <button onClick={() => onDelete(doc.id)} style={{ color: SUBTEXT }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
