"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Flame } from "lucide-react";

const ACCENT = "#5ff2ff";

interface TopicMastery {
  topicId: string;
  topicName: string;
  attempted: number;
  correct: number;
  accuracyPct: number;
  masteryScore: number;
}

interface Snapshot {
  totalAttempts: number;
  averageScorePct: number;
  completionPct: number;
  averageTimePerQuestionSec: number;
  currentStreak: number;
  longestStreak: number;
  topicMastery: TopicMastery[];
}

export default function QuizAnalyticsPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/quiz/analytics");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load analytics.");
      setSnapshot(data.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/quiz" className="mb-4 flex w-fit items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ArrowLeft size={14} /> Back to quizzes
      </Link>
      <h1 className="mb-6 text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        Quiz analytics
      </h1>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}

      {!error && !snapshot && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {!error && snapshot && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Attempts" value={String(snapshot.totalAttempts)} />
            <Stat label="Avg. score" value={`${snapshot.averageScorePct}%`} />
            <Stat label="Completion" value={`${snapshot.completionPct}%`} />
            <Stat label="Avg. sec / Q" value={String(snapshot.averageTimePerQuestionSec)} />
          </div>

          <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <Flame size={20} style={{ color: ACCENT }} />
            <p className="text-sm text-white/70">
              <span className="font-medium text-white">{snapshot.currentStreak}-day streak</span> · longest {snapshot.longestStreak} days
            </p>
          </div>

          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.12em] text-white/40">Topic mastery</h2>
          {snapshot.topicMastery.length === 0 ? (
            <p className="text-sm text-white/50">No topic data yet — take a few more quizzes to see your strengths and weak areas.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {snapshot.topicMastery.map((t) => (
                <div key={t.topicId} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-white">{t.topicName}</span>
                    <span className="text-white/50">{t.masteryScore}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${t.masteryScore}%`, backgroundColor: t.masteryScore < 50 ? "#f87171" : t.masteryScore >= 80 ? "#34d399" : ACCENT }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
      <p className="text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}
