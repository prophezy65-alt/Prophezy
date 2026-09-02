"use client";

import { useMemo } from "react";
import { Library, Sparkles, FileCheck2, TrendingUp, Quote } from "lucide-react";
import { usePapers } from "./useResearchQueries";
import { useCountUp } from "./hooks/useCountUp";
import { getQuoteOfTheDay } from "./data/researchQuotes";

/**
 * components/research/ResearchHero.tsx
 *
 * ============================================================================
 * REDESIGN v3 — light card + lime-green accent, matching the reference
 * ============================================================================
 * Palette pulled from the DeFi swap UI reference: a soft off-white card
 * (NOT pure #fff — "light white, not bright white" per the ask), a vivid
 * lime/chartreuse accent (Tailwind's lime-400/500, closest match to the
 * reference's green), near-black headline text, warm gray for muted text.
 *
 * IMPORTANT — scope of what changed: this card is now genuinely light,
 * sitting on your app's existing DARK page background/sidebar, which I
 * don't control and haven't touched. That's not an accident — it mirrors
 * the reference image's own composition (a light, glassy card floating on
 * a dark surrounding page), and it's the only coherent way to go light
 * here without touching your global theme file (which I don't have).
 * A soft shadow is doing the work of separating the card from the dark
 * page behind it, same as the reference's card does against its own
 * black-ish background.
 *
 * `text-ink` / `text-mist` / `bg-surface` (this app's dark-theme tokens —
 * light text on dark backgrounds) are NOT used anywhere in this file
 * anymore — they'd be invisible on a light card. Every color here is an
 * explicit light-mode Tailwind class instead.
 */

const STATS_CONFIG = [
  { key: "total", icon: Library, label: "Papers in Library" },
  { key: "fullText", icon: FileCheck2, label: "Full Text Extracted" },
  { key: "summarized", icon: Sparkles, label: "Summarized" },
  { key: "thisWeek", icon: TrendingUp, label: "Added This Week" },
] as const;

export function ResearchHero() {
  const { data, isLoading } = usePapers("");
  const papers = data?.papers ?? [];
  const quote = useMemo(() => getQuoteOfTheDay(), []);

  const values: Record<(typeof STATS_CONFIG)[number]["key"], number> = {
    total: papers.length,
    fullText: papers.filter((p) => p.document_id).length,
    summarized: papers.filter((p) => p.summary_md).length,
    thisWeek: papers.filter((p) => Date.now() - new Date(p.created_at).getTime() < 7 * 24 * 60 * 60 * 1000).length,
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-xl shadow-black/30">
      {/* Quote strip */}
      <div className="flex items-start gap-3 border-b border-stone-200 bg-white px-6 py-4">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-lime-600" />
        <div>
          <p className="font-display text-sm italic text-neutral-900">&ldquo;{quote.text}&rdquo;</p>
          <p className="mt-0.5 text-xs text-neutral-700">— {quote.author}</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {STATS_CONFIG.map((stat, i) => (
          <StatCell
            key={stat.key}
            icon={stat.icon}
            label={stat.label}
            value={values[stat.key]}
            loading={isLoading}
            first={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

interface StatCellProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  loading: boolean;
  first: boolean;
}

function StatCell({ icon: Icon, label, value, loading, first }: StatCellProps) {
  const animated = useCountUp(value);

  return (
    <div
      className={`flex flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-lime-50 ${
        first ? "" : "border-t border-stone-200 sm:border-t-0 sm:border-l"
      }`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400 text-neutral-900">
        <Icon className="h-4 w-4" />
      </div>
      <p className="font-display text-xl font-semibold tabular-nums text-neutral-900">{loading ? "–" : animated}</p>
      <p className="text-xs text-neutral-700">{label}</p>
    </div>
  );
}
