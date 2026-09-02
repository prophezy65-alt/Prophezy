"use client";

import { useEffect, useState } from "react";
import { Trash2, ChevronRight, History } from "lucide-react";
import { EXAM_PREDICTOR_COLORS as C } from "./palette";

interface PredictionSummary {
  id: string;
  subjectName: string;
  questionCountRequested: number;
  previousPapersUsed: number;
  createdAt: string;
}

interface Props {
  /** Bump this number from the parent after a new analysis completes to refetch the list. */
  refreshKey: number;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function ExamPredictorHistory({ refreshKey, onSelect, disabled }: Props) {
  const [items, setItems] = useState<PredictionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/exam-predictor/history")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Couldn't load your prediction history.");
        return data.predictions as PredictionSummary[];
      })
      .then((predictions) => {
        if (!cancelled) setItems(predictions);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your prediction history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string, subjectName: string) {
    if (!window.confirm(`Delete the prediction for "${subjectName}"? This can't be undone.`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/exam-predictor/history/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't delete that prediction.");
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that prediction.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-3xl px-1 py-4 text-center text-sm" style={{ color: C.onCanvasMuted }}>
        Loading your prediction history…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="w-full max-w-3xl rounded-xl px-4 py-3 text-sm" style={{ background: C.wineRedFaint, color: C.onCanvasMuted }}>
        {error}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-3xl rounded-2xl p-6" style={{ background: C.canvas, border: `1px solid ${C.wineRed}` }}>
      <div className="mb-4 flex items-center gap-2">
        <History size={16} style={{ color: C.onCanvasMuted }} />
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: C.onCanvasMuted }}>
          Your past predictions
        </h3>
      </div>

      {error && (
        <p className="mb-3 text-xs" style={{ color: C.onCanvasMuted }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors"
            style={{ borderColor: C.wineRed }}
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              disabled={disabled || deletingId === item.id}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" style={{ color: C.onCanvas }}>
                  {item.subjectName}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: C.onCanvasMuted }}>
                  {formatDate(item.createdAt)} · {item.questionCountRequested} questions
                  {item.previousPapersUsed > 0 ? ` · ${item.previousPapersUsed} previous paper${item.previousPapersUsed === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: C.onCanvasMuted }} />
            </button>

            <button
              type="button"
              onClick={() => handleDelete(item.id, item.subjectName)}
              disabled={disabled || deletingId === item.id}
              aria-label={`Delete prediction for ${item.subjectName}`}
              className="shrink-0 rounded-lg p-2 transition-colors hover:bg-white/5 disabled:opacity-40"
              style={{ color: C.onCanvasMuted }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
