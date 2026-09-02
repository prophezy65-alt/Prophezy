"use client";

import type { SortKey } from "@/lib/internships/types";
import { cn } from "@/lib/utils";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "recent", label: "Newest" },
  { value: "deadline", label: "Deadline soon" },
  { value: "stipend_desc", label: "Highest stipend" },
  { value: "stipend_asc", label: "Lowest stipend" },
  { value: "match_score", label: "Best match" },
];

interface SortSelectProps {
  value: SortKey;
  onChange: (value: SortKey) => void;
  className?: string;
}

export function SortSelect({ value, onChange, className }: SortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      className={cn(
        "h-11 rounded-xl border border-border bg-surface/40 px-3.5 text-sm text-ink transition-colors",
        "focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30",
        className,
      )}
    >
      {OPTIONS.map((opt) => (
        // The dropdown's own popup list is rendered by the OS/browser, not
        // by our CSS — Tailwind classes on <select> don't reach it.
        // Chromium (which this app is mostly viewed in) does respect an
        // explicit inline style on each <option>, so that's set directly
        // here rather than via a class, to actually get a dark background
        // instead of the browser's default light popup.
        <option
          key={opt.value}
          value={opt.value}
          style={{ backgroundColor: "hsl(var(--surface))", color: "hsl(var(--ink))" }}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}
