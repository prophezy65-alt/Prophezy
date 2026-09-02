"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RotateCcw } from "lucide-react";

const ACCENT = "#5ff2ff";

interface AttemptRow {
  id: string;
  quizId: string;
  quizTitle: string;
  quizDifficulty: string;
  status: string;
  finalScore: number | null;
  maxScore: number;
  accuracyPct: number | null;
  createdAt: string;
}

export default function QuizHistoryPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/quiz/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load history.");
      setAttempts(data.attempts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(quizId: string) {
    setRetryingId(quizId);
    try {
      const res = await fetch(`/api/quiz/${quizId}/attempts`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start a new attempt.");
      router.push(`/app/quiz/${quizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a new attempt.");
      setRetryingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/quiz" className="mb-4 flex w-fit items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ArrowLeft size={14} /> Back to quizzes
      </Link>
      <h1 className="mb-6 text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        Quiz history
      </h1>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}

      {!error && attempts === null && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {!error && attempts !== null && attempts.length === 0 && <p className="text-sm text-white/50">No attempts yet — take a quiz to see it here.</p>}

      {!error && attempts !== null && attempts.length > 0 && (
        <div className="flex flex-col gap-2">
          {attempts.map((a) => {
            const scorePct = a.status === "graded" && a.maxScore > 0 ? Math.round(((a.finalScore ?? 0) / a.maxScore) * 10000) / 100 : null;
            return (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div>
                  <p className="text-sm font-medium text-white">{a.quizTitle}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {a.quizDifficulty} · {new Date(a.createdAt).toLocaleDateString()} · {a.status}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {scorePct !== null && (
                    <span className="text-sm font-medium" style={{ color: ACCENT }}>
                      {scorePct}%
                    </span>
                  )}
                  {a.status === "graded" && (
                    <Link href={`/app/quiz/attempts/${a.id}`} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/20">
                      Review
                    </Link>
                  )}
                  <button
                    onClick={() => retry(a.quizId)}
                    disabled={retryingId === a.quizId}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:border-white/20 disabled:opacity-50"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
