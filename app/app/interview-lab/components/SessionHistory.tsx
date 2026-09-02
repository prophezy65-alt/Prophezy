/**
 * app/app/interview-lab/components/SessionHistory.tsx
 *
 * Cross-session view: an analytics summary (average score, attempts, strong/
 * weak areas) plus the list of past sessions with open/resume + delete.
 */
"use client";

import { motion } from "framer-motion";
import { Plus, Trash2, Clock, CheckCircle2, PlayCircle, Target, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SectionLabel, Spinner } from "./primitives";
import { useAnalytics, useDeleteSession, useSessions } from "../hooks";
import { interviewTypeLabel, type SessionListItem } from "../types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_META = {
  active: { tone: "signal", icon: PlayCircle, label: "In progress" },
  completed: { tone: "success", icon: CheckCircle2, label: "Completed" },
  abandoned: { tone: "neutral", icon: Clock, label: "Abandoned" },
} as const;

export function SessionHistory({
  onOpen,
  onNew,
  notify,
}: {
  onOpen: (item: SessionListItem) => void;
  onNew: () => void;
  notify: (message: string, tone: "success" | "error" | "info") => void;
}) {
  const sessions = useSessions();
  const analytics = useAnalytics();
  const remove = useDeleteSession();

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    remove.mutate(id, {
      onSuccess: () => notify("Session deleted.", "success"),
      onError: (err) => notify(err instanceof Error ? err.message : "Delete failed.", "error"),
    });
  }

  const a = analytics.data;
  const hasAnalytics = a && a.totalAttempts > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Interview Lab
          </h1>
          <p className="mt-1 text-sm text-mist">Mock interviews with AI feedback, scoring and a skill-gap roadmap.</p>
        </div>
        <Button type="button" onClick={onNew}>
          <Plus size={16} /> New interview
        </Button>
      </div>

      {/* analytics */}
      {hasAnalytics && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-5">
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Target size={12} className="text-signal" /> Your performance
            </span>
          </SectionLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Avg score" value={`${a.averageScore.toFixed(1)}/10`} />
            <Stat label="Attempts" value={String(a.totalAttempts)} />
            <Stat label="Strong areas" value={String(a.strongAreas.length)} />
            <Stat label="Focus areas" value={String(a.weakAreas.length)} />
          </div>
          {(a.strongAreas.length > 0 || a.weakAreas.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.strongAreas.map((s) => (
                <Badge key={`s-${s}`} tone="success">
                  {s}
                </Badge>
              ))}
              {a.weakAreas.map((s) => (
                <Badge key={`w-${s}`} tone="pulse">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* list */}
      {sessions.isLoading ? (
        <Spinner label="Loading your sessions…" />
      ) : sessions.isError ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-danger">
            {sessions.error instanceof Error ? sessions.error.message : "Failed to load sessions."}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void sessions.refetch()}
            disabled={sessions.isFetching}
          >
            <RotateCcw size={15} className={sessions.isFetching ? "animate-spin" : undefined} /> Try again
          </Button>
        </div>
      ) : (sessions.data ?? []).length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm text-mist">No interviews yet.</p>
          <Button type="button" onClick={onNew}>
            <Plus size={16} /> Start your first interview
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {(sessions.data ?? []).map((s) => {
            const meta = STATUS_META[s.status];
            const StatusIcon = meta.icon;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onOpen(s)}
                className="glass-panel flex cursor-pointer items-center gap-4 p-4 transition-colors hover:border-signal/40"
              >
                <StatusIcon size={18} className={cn(meta.tone === "success" ? "text-success" : meta.tone === "signal" ? "text-signal" : "text-mist")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{s.role}</p>
                  <p className="truncate text-xs text-mist">
                    {interviewTypeLabel(s.interview_type)} · {s.seniority}
                    {s.company ? ` · ${s.company}` : ""} · {formatDate(s.started_at)}
                  </p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, s.id)}
                  disabled={remove.isPending}
                  className="text-mist transition-colors hover:text-danger"
                  aria-label="Delete session"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xl font-medium text-ink" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
      <p className="text-[11px] uppercase tracking-[0.14em] text-mist" style={{ fontFamily: "var(--font-mono)" }}>
        {label}
      </p>
    </div>
  );
}
