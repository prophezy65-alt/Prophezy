"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useTopicSearch, useSavePaperFromSearch } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { ResearchApiError } from "./researchApi";
import { PaperResultCard } from "./PaperResultCard";
import type { Paper } from "@/lib/research/models/paper.types";

/**
 * components/research/TopicExplorerPanel.tsx
 *
 * Same logic as before (real Postgres search, zero Gemini — see the
 * REPLACES header comment history in earlier versions of this file) —
 * this pass is styling only, matching the light + lime treatment now
 * used by ResearchHero/PaperCard/PaperResultCard. Dropped the shared
 * `Input`/`Button` components for the same reason as the two card files:
 * they likely carry this app's dark-theme defaults, and this component
 * now needs to be light-mode explicit throughout.
 */
export function TopicExplorerPanel() {
  const [topic, setTopic] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const topicSearch = useTopicSearch();
  const savePaper = useSavePaperFromSearch();
  const toast = useResearchToast();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function runSearch(topicFilter?: string) {
    if (!topic.trim()) return;
    try {
      await topicSearch.mutateAsync({ topic: topic.trim(), topicFilter });
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Topic search failed.");
    }
  }

  async function handleChipClick(label: string) {
    const next = activeChip === label ? null : label;
    setActiveChip(next);
    await runSearch(next ?? undefined);
  }

  async function handleSave(paper: Paper) {
    setSavingId(paper.id);
    try {
      await savePaper.mutateAsync(paper);
      toast.success(`"${paper.title}" saved to your library.`);
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Failed to save paper.");
    } finally {
      setSavingId(null);
    }
  }

  const result = topicSearch.data;
  const results = result?.papers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void runSearch(activeChip ?? undefined)}
          placeholder="e.g. Retrieval Augmented Generation"
          className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-200"
        />
        <button
          onClick={() => void runSearch(activeChip ?? undefined)}
          disabled={topicSearch.isPending || !topic.trim()}
          className="flex items-center justify-center rounded-lg bg-lime-400 px-4 text-neutral-900 transition-colors hover:bg-lime-300 disabled:opacity-50"
        >
          {topicSearch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </button>
      </div>

      {result && result.chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.chips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => void handleChipClick(chip.label)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                activeChip === chip.label
                  ? "border-lime-500 bg-lime-400 text-neutral-900"
                  : "border-stone-200 bg-white text-neutral-700 hover:border-stone-300 hover:text-neutral-700"
              }`}
            >
              {chip.label} ({chip.count}
              {result.chipsApproximate ? "+" : ""})
            </button>
          ))}
        </div>
      )}

      {topicSearch.isPending && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-lime-500" />
        </div>
      )}

      {!topicSearch.isPending && topicSearch.isSuccess && results.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-700">
          No papers found for &ldquo;{topic}&rdquo; yet. The synced library grows daily — try a broader term, or check
          back after the next sync.
        </p>
      )}

      <div className="space-y-3">
        {results.map((paper) => (
          <PaperResultCard key={paper.id} paper={paper} onSave={handleSave} saving={savingId === paper.id} />
        ))}
      </div>

      {result && result.total > results.length && (
        <p className="text-center text-xs text-neutral-600">
          Showing {results.length} of {result.total}
          {result.chipsApproximate ? "+" : ""} matching papers.
        </p>
      )}
    </div>
  );
}
