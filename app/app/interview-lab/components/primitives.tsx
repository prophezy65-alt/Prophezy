/**
 * app/app/interview-lab/components/primitives.tsx
 *
 * Small presentational building blocks shared across the Interview Lab,
 * built on the app's existing design tokens (signal/pulse/glass/ink/mist).
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, X, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info";
export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONE_ICON = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const TONE_COLOR: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-signal",
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = TONE_ICON[t.tone];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className="glass-panel pointer-events-auto flex items-start gap-3 p-4 text-sm text-ink"
            >
              <Icon size={18} className={cn("mt-0.5 shrink-0", TONE_COLOR[t.tone])} strokeWidth={1.8} />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="shrink-0 text-mist transition-colors hover:text-ink"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 text-[11px] uppercase tracking-[0.16em] text-mist"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </p>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-mist">
      <Loader2 size={16} className="animate-spin text-signal" />
      {label ?? "Loading…"}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 8) return "hsl(var(--success))";
  if (score >= 6) return "hsl(var(--signal))";
  return "hsl(var(--danger))";
}

export function ScoreMeter({ label, score }: { label: string; score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const color = scoreColor(score);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-mist">{label}</span>
        <span className="font-medium text-ink" style={{ fontFamily: "var(--font-mono)" }}>
          {score.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/5">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${color.replace(")", " / 0.12)")}`, color }}
    >
      {score.toFixed(1)}/10
    </span>
  );
}
