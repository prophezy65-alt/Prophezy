"use client";

import { Loader2, BookmarkPlus } from "lucide-react";
import type { Paper } from "@/lib/research/models/paper.types";

/**
 * components/research/PaperResultCard.tsx
 *
 * Same light + lime treatment as PaperCard.tsx (see that file's header
 * comment for why the shared Card/Badge/Button components were dropped in
 * favor of plain elements — same reasoning applies here).
 */
interface PaperResultCardProps {
  paper: Paper;
  onSave: (paper: Paper) => void;
  saving: boolean;
}

export function PaperResultCard({ paper, onSave, saving }: PaperResultCardProps) {
  return (
    <div className="group rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-medium text-neutral-900">{paper.title}</h3>
          {paper.authors.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-neutral-700">{paper.authors.map((a) => a.name).join(", ")}</p>
          )}
          {paper.abstract && <p className="mt-2 line-clamp-3 text-xs text-neutral-700">{paper.abstract}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-600">
              {paper.source}
            </span>
            {paper.fieldsOfStudy?.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-lime-300 bg-lime-50 px-2 py-0.5 text-xs font-medium text-lime-900 font-semibold"
              >
                {topic}
              </span>
            ))}
            {paper.publishedDate && <span className="text-xs text-neutral-600">{paper.publishedDate}</span>}
          </div>
        </div>
        <button
          disabled={saving}
          onClick={() => onSave(paper)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-neutral-900 transition-transform duration-150 hover:bg-lime-300 group-hover:scale-105 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  );
}
