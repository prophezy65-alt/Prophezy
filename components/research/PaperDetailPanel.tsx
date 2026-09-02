"use client";

import { Loader2, Sparkles, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaper, useGenerateSummary } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { ResearchApiError } from "./researchApi";

/**
 * REMOVED: Citations tab and everything behind it — useExtractCitations,
 * handleExtractCitations, the citations list render block, the Quote icon
 * import, and the tab-switching state (only one tab left, so it's a
 * static header now, not a clickable tab). Explicit "remove it, it's of
 * no use" request — not a bug fix.
 *
 * The backend (citation.service.ts, the citations API route, the
 * research_citations table) is untouched by this change — only this UI
 * entry point is gone. Say the word if you want those removed too.
 */
interface PaperDetailPanelProps {
  paperId: string;
  onClose: () => void;
  onOpenChat: (paperId: string) => void;
}

/** Minimal markdown-to-JSX for the AI summary — headings, bullets, bold — no extra dependency needed. */
function SummaryMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-4 font-display text-sm font-semibold text-signal first:mt-0">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="ml-4 list-disc text-mist">
              {line.slice(2)}
            </li>
          );
        }
        if (!line.trim()) return null;
        const bolded = line.replace(/\*\*(.+?)\*\*/g, "$1");
        const isBold = /^\*\*.+\*\*/.test(line);
        return (
          <p key={i} className={isBold ? "font-medium text-ink" : "text-mist"}>
            {bolded}
          </p>
        );
      })}
    </div>
  );
}

export function PaperDetailPanel({ paperId, onClose, onOpenChat }: PaperDetailPanelProps) {
  const { data, isLoading } = usePaper(paperId);
  const generateSummary = useGenerateSummary(paperId);
  const toast = useResearchToast();

  async function handleGenerateSummary(forceRefresh: boolean) {
    try {
      await generateSummary.mutateAsync(forceRefresh);
      toast.success("Summary generated.");
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Failed to generate summary.");
    }
  }

  if (isLoading || !data) {
    return (
      <Card className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-signal" />
      </Card>
    );
  }

  const { paper } = data;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <div className="min-w-0">
          <CardTitle className="truncate">{paper.title}</CardTitle>
          {paper.authors.length > 0 && <p className="mt-1 truncate text-xs text-mist">{paper.authors.join(", ")}</p>}
        </div>
        <button onClick={onClose} className="shrink-0 rounded p-1 text-mist hover:bg-surface hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>

      <div className="mb-4 flex shrink-0 gap-1 border-b border-border/60 pb-2">
        <span className="flex items-center gap-1.5 rounded-md bg-signal/10 px-3 py-1.5 text-xs font-medium text-signal">
          <Sparkles className="h-3.5 w-3.5" /> Summary
        </span>
        <button
          onClick={() => onOpenChat(paperId)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-mist transition-colors hover:text-ink"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mb-3 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            disabled={generateSummary.isPending}
            onClick={() => handleGenerateSummary(Boolean(paper.summary_md))}
          >
            {generateSummary.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : paper.summary_md ? (
              "Regenerate summary"
            ) : (
              "Generate summary"
            )}
          </Button>
        </div>
        {paper.summary_md ? (
          <SummaryMarkdown markdown={paper.summary_md} />
        ) : (
          <p className="text-sm text-mist">
            No summary yet.{" "}
            {paper.document_id
              ? "Generate one from the full uploaded text."
              : "This paper has no uploaded PDF — summary will use the abstract."}
          </p>
        )}
      </div>
    </Card>
  );
}
