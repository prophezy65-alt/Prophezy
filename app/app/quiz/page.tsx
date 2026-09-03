"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Loader2, Sparkles, History, Trophy, BarChart3, Upload, FileText, X } from "lucide-react";

const ACCENT = "#5ff2ff";

interface QuizLibraryItem {
  id: string;
  title: string;
  difficulty: string;
  examMode: string;
  questionCount: number;
  timeLimitSec: number | null;
  bestScorePct: number | null;
  attemptsCount: number;
  createdAt: string;
}

const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
const EXAM_MODES = [
  { value: "practice", label: "Practice" },
  { value: "timed_test", label: "Timed test" },
  { value: "mock_exam", label: "Mock exam" },
  { value: "chapter_test", label: "Chapter test" },
] as const;
const OPTIONAL_TYPES = [
  { value: "true_false", label: "True / False" },
  { value: "multiple_select", label: "Multiple select" },
  { value: "ordering", label: "Ordering" },
  { value: "match_following", label: "Match the following" },
] as const;

export default function QuizHubPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizLibraryItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sourceMode, setSourceMode] = useState<"topic" | "upload">("topic");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("medium");
  const [examMode, setExamMode] = useState<(typeof EXAM_MODES)[number]["value"]>("practice");
  const [questionCount, setQuestionCount] = useState(10);
  const [extraTypes, setExtraTypes] = useState<string[]>([]);
  const [isTimed, setIsTimed] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadLibrary() {
    setLoadError(null);
    try {
      const res = await fetch("/api/quiz");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load your quizzes.", { cause: data._devLocation });
      setQuizzes(data.quizzes);
    } catch (err) {
      setLoadError(err instanceof Error ? `${err.message}${err.cause ? ` — ${err.cause}` : ""}` : "Failed to load your quizzes.");
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  async function handleFileSelect(selected: File | null) {
    setUploadError(null);
    setDocumentId(null);
    setFile(selected);
    if (!selected) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", selected);
      const res = await fetch("/api/quiz/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.cause ? `${data.error} (${data.details.cause})` : (data.error ?? "Upload failed."));
      setDocumentId(data.documentId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setFile(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (sourceMode === "topic" && !topic.trim()) {
      setGenError("Enter a subject or topic first.");
      return;
    }
    if (sourceMode === "upload" && !documentId) {
      setGenError(uploading ? "Still processing your file — wait a moment and try again." : "Upload a file first.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source:
            sourceMode === "upload" ? { sourceType: "upload", uploadId: documentId } : { sourceType: "topic", topic: topic.trim() },
          examMode,
          difficulty,
          isAdaptive: false,
          questionTypes: ["mcq", ...extraTypes],
          questionCount,
          timeLimitSec: isTimed ? minutes * 60 : null,
          negativeMarking: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issueSummary = Array.isArray(data.issues)
          ? data.issues
              .slice(0, 3)
              .map((d: any) => `#${d.index}: ${d.issues?.[0]?.path?.join(".")} — ${d.issues?.[0]?.message}`)
              .join(" · ")
          : null;
        throw new Error(issueSummary ? `${data.error} (${issueSummary})` : (data.error ?? "Generation failed."));
      }
      const shortfall = questionCount - data.quiz.questionCount;
      const query = shortfall > 0 ? `?shortfall=${shortfall}&requested=${questionCount}` : "";
      router.push(`/app/quiz/${data.quiz.id}${query}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
        Quiz engine
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium text-white sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Generate a quiz
        </h1>
        <div className="flex gap-2">
          <Link href="/app/quiz/history" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-white/20 hover:text-white">
            <History size={14} /> History
          </Link>
          <Link href="/app/quiz/leaderboard" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-white/20 hover:text-white">
            <Trophy size={14} /> Leaderboard
          </Link>
          <Link href="/app/quiz/analytics" className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-white/20 hover:text-white">
            <BarChart3 size={14} /> Analytics
          </Link>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="mb-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSourceMode("topic")}
            className="rounded-xl border px-3 py-1.5 text-xs"
            style={{ borderColor: sourceMode === "topic" ? ACCENT : "rgba(255,255,255,0.1)", color: sourceMode === "topic" ? ACCENT : "rgba(255,255,255,0.6)" }}
          >
            From a topic
          </button>
          <button
            type="button"
            onClick={() => setSourceMode("upload")}
            className="rounded-xl border px-3 py-1.5 text-xs"
            style={{ borderColor: sourceMode === "upload" ? ACCENT : "rgba(255,255,255,0.1)", color: sourceMode === "upload" ? ACCENT : "rgba(255,255,255,0.6)" }}
          >
            From a file
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {sourceMode === "topic" ? (
              <>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Subject or topic</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Thermodynamics, Data Structures, Cell Biology"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent,#5ff2ff)] focus:outline-none"
                />
              </>
            ) : (
              <>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Upload a PDF, Word doc, or image</label>
                {!file ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-sm text-white/40 hover:border-white/30 hover:text-white/60"
                  >
                    <Upload size={18} />
                    Click to choose a file (PDF, DOC/DOCX, PNG, JPG)
                  </button>
                ) : (
                  <div className="flex h-11 items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4">
                    <span className="flex items-center gap-2 truncate text-sm text-white/80">
                      <FileText size={14} className="shrink-0" style={{ color: ACCENT }} />
                      <span className="truncate">{file.name}</span>
                      {uploading && <Loader2 size={12} className="shrink-0 animate-spin text-white/40" />}
                      {documentId && !uploading && <span className="shrink-0 text-xs text-emerald-400">Ready</span>}
                    </span>
                    <button type="button" onClick={() => handleFileSelect(null)} className="shrink-0 text-white/30 hover:text-white/60">
                      <X size={14} />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                {uploadError && <p className="mt-1.5 text-xs text-red-400">{uploadError}</p>}
              </>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d} className="bg-[#0a0a0a]">
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Exam mode</label>
            <select
              value={examMode}
              onChange={(e) => setExamMode(e.target.value as typeof examMode)}
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              {EXAM_MODES.map((m) => (
                <option key={m.value} value={m.value} className="bg-[#0a0a0a]">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Number of questions</label>
            <input
              type="number"
              min={5}
              max={50}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(5, Math.min(50, Number(e.target.value) || 5)))}
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white focus:border-white/30 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Question types (MCQ always included)</label>
            <div className="flex flex-wrap gap-3">
              {OPTIONAL_TYPES.map((t) => {
                const checked = extraTypes.includes(t.value);
                return (
                  <label key={t.value} className="flex items-center gap-2 text-sm text-white/60">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setExtraTypes((prev) => (e.target.checked ? [...prev, t.value] : prev.filter((v) => v !== t.value)))}
                      className="h-4 w-4 rounded border-white/20 bg-black/30"
                    />
                    {t.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-white/60">
              <input type="checkbox" checked={isTimed} onChange={(e) => setIsTimed(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-black/30" />
              Timed
            </label>
            {isTimed && (
              <input
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
                className="h-9 w-24 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white focus:outline-none"
              />
            )}
            {isTimed && <span className="text-xs text-white/40">minutes</span>}
          </div>
        </div>

        {genError && <p className="mt-4 text-sm text-red-400">{genError}</p>}

        <button
          type="submit"
          disabled={generating || uploading}
          className="mt-6 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-black transition-all disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? "Generating…" : "Generate quiz"}
        </button>
      </form>

      <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.12em] text-white/40">Your quizzes</h2>

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {loadError}{" "}
          <button onClick={loadLibrary} className="underline">
            Retry
          </button>
        </div>
      )}

      {!loadError && quizzes === null && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 size={14} className="animate-spin" /> Loading your quizzes…
        </div>
      )}

      {!loadError && quizzes !== null && quizzes.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-14 text-center">
          <Brain size={28} style={{ color: ACCENT }} />
          <p className="text-sm text-white/50">No quizzes yet — generate your first one above.</p>
        </div>
      )}

      {!loadError && quizzes !== null && quizzes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Link
              key={quiz.id}
              href={`/app/quiz/${quiz.id}`}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20"
            >
              <span className="text-sm font-medium text-white">{quiz.title}</span>
              <span className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-white/40">
                <span className="rounded-full border border-white/10 px-2 py-0.5">{quiz.difficulty}</span>
                <span className="rounded-full border border-white/10 px-2 py-0.5">{quiz.questionCount} Qs</span>
                {quiz.timeLimitSec && <span className="rounded-full border border-white/10 px-2 py-0.5">{Math.round(quiz.timeLimitSec / 60)}m</span>}
              </span>
              <span className="mt-1 text-xs text-white/50">
                {quiz.attemptsCount > 0
                  ? `Best score: ${quiz.bestScorePct}% · ${quiz.attemptsCount} attempt${quiz.attemptsCount === 1 ? "" : "s"}`
                  : "Not attempted yet"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
