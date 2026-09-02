"use client";

import { useEffect, useState } from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudySessions, useStartSession, useEndSession } from "@/lib/study-hub-client/hooks";

function formatElapsed(startedAt: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function StudySessionTimer() {
  const { data, isLoading } = useStudySessions();
  const start = useStartSession();
  const end = useEndSession();
  const [subject, setSubject] = useState("");
  const [, forceTick] = useState(0);

  const active = data?.activeSession ?? null;

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (isLoading) {
    return <div className="glass-panel h-24 animate-pulse rounded-2xl border border-border" />;
  }

  if (active) {
    return (
      <div className="glass-panel flex items-center justify-between gap-4 rounded-2xl border border-signal/30 bg-signal/[0.04] p-5">
        <div>
          <p className="text-xs text-mist">{active.subject ?? "Studying"}</p>
          <p className="font-display text-2xl font-medium text-ink tabular-nums">{formatElapsed(active.startedAt)}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => end.mutate({ sessionId: active.id })}
          disabled={end.isPending}
          className="gap-1.5"
        >
          {end.isPending ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
          End session
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl border border-border p-5">
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="What are you studying? (optional)"
        className="flex-1"
      />
      <Button
        variant="primary"
        onClick={() => start.mutate(subject || undefined)}
        disabled={start.isPending}
        className="gap-1.5"
      >
        {start.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        Start studying
      </Button>
    </div>
  );
}
