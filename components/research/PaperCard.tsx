"use client";

import { FileText, Trash2, ExternalLink } from "lucide-react";
import type { ResearchPaperRow } from "@/lib/research/models/db.types";

/**
 * components/research/PaperCard.tsx
 *
 * VISUAL REFRESH v3 — light card + lime accent, matching ResearchHero.
 * Props/logic identical to the original (onSelect, onDelete, selected,
 * which badges show) — this is styling only. Dropped the shared `Card`/
 * `Badge` UI components for this pass since those presumably carry your
 * app's dark-theme styling baked in; plain elements here keep the light
 * palette fully explicit and predictable rather than fighting an
 * imported component's own dark defaults.
 */
function formatDate(value: string | null): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "";
  }
}

interface PaperCardProps {
  paper: ResearchPaperRow;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
}

export function PaperCard({ paper, selected, onSelect, onDelete, deleting }: PaperCardProps) {
  return (
    <div
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-stone-50 p-4 pl-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${
        selected ? "border-lime-500" : "border-stone-200 hover:border-stone-300"
      }`}
      onClick={onSelect}
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 transition-all duration-200 group-hover:w-1.5 ${
          paper.summary_md ? "bg-lime-400" : paper.document_id ? "bg-lime-200" : "bg-stone-200"
        }`}
      />
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-lime-100 p-2 transition-colors group-hover:bg-lime-200">
          <FileText className="h-4 w-4 text-lime-900" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-sm font-medium text-neutral-900">{paper.title}</h3>
          {paper.authors.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-neutral-700">{paper.authors.join(", ")}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {paper.document_id && (
              <span className="rounded-full border border-lime-300 bg-lime-50 px-2 py-0.5 text-xs font-medium text-lime-900 font-semibold">
                Full text
              </span>
            )}
            {paper.summary_md && (
              <span className="rounded-full border border-lime-400 bg-lime-100 px-2 py-0.5 text-xs font-medium text-lime-900 font-semibold">
                Summarized
              </span>
            )}
            {paper.published_at && <span className="text-xs text-neutral-600">{formatDate(paper.published_at)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {paper.source_url && (
            <a
              href={paper.source_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1.5 text-neutral-600 hover:bg-stone-100 hover:text-neutral-700"
              aria-label="Open source"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="rounded p-1.5 text-neutral-600 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
            aria-label="Delete paper"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
