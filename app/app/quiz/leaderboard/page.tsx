"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Trophy } from "lucide-react";

const ACCENT = "#5ff2ff";

interface Entry {
  userId: string;
  rank: number;
  score: number;
  attemptsCount: number;
}

const SCOPES = [
  { value: "global", label: "Global" },
  { value: "weekly", label: "This week" },
  { value: "subject", label: "By subject" },
] as const;

export default function QuizLeaderboardPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("global");
  const [subject, setSubject] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (scope === "subject" && !subject.trim()) {
      setEntries([]);
      return;
    }
    setError(null);
    setEntries(null);
    try {
      const params = new URLSearchParams({ scope });
      if (scope === "subject") params.set("subject", subject.trim());
      const res = await fetch(`/api/quiz/leaderboard?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load leaderboard.");
      setEntries(data.entries);
      setCurrentUserId(data.currentUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    }
  }, [scope, subject]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/quiz" className="mb-4 flex w-fit items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ArrowLeft size={14} /> Back to quizzes
      </Link>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        <Trophy size={22} style={{ color: ACCENT }} /> Leaderboard
      </h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setScope(s.value)}
            className="rounded-xl border px-3 py-1.5 text-xs"
            style={{ borderColor: scope === s.value ? ACCENT : "rgba(255,255,255,0.1)", color: scope === s.value ? ACCENT : "rgba(255,255,255,0.6)" }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {scope === "subject" && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={load}
          placeholder="Enter a subject, e.g. Physics"
          className="mb-4 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}{" "}
          <button onClick={load} className="underline">
            Retry
          </button>
        </div>
      )}

      {!error && entries === null && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {!error && entries !== null && entries.length === 0 && (
        <p className="text-sm text-white/50">{scope === "subject" ? "Enter a subject to see its leaderboard." : "No scores yet — take a quiz to appear here."}</p>
      )}

      {!error && entries !== null && entries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {entries.map((e) => (
            <div
              key={e.userId}
              className="flex items-center justify-between rounded-xl border px-4 py-3"
              style={{
                borderColor: e.userId === currentUserId ? ACCENT : "rgba(255,255,255,0.1)",
                backgroundColor: e.userId === currentUserId ? `${ACCENT}0d` : "rgba(255,255,255,0.02)",
              }}
            >
              <span className="flex items-center gap-3 text-sm text-white">
                <span className="w-6 text-white/40">#{e.rank}</span>
                {e.userId === currentUserId ? "You" : `Player ${e.userId.slice(0, 6)}`}
              </span>
              <span className="text-sm text-white/50">
                {e.score} pts · {e.attemptsCount} attempts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
