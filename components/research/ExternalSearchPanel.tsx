"use client";

import { useState } from "react";
import { Loader2, Search, BookmarkPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExternalSearch, useSavePaperFromSearch } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { ResearchApiError } from "./researchApi";

export function ExternalSearchPanel() {
  const [query, setQuery] = useState("");
  const search = useExternalSearch();
  const savePaper = useSavePaperFromSearch();
  const toast = useResearchToast();

  async function handleSearch() {
    if (!query.trim()) return;
    try {
      await search.mutateAsync({ query: query.trim(), kind: "keyword" });
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Search failed.");
    }
  }

  async function handleSave(paper: Parameters<typeof savePaper.mutateAsync>[0]) {
    try {
      await savePaper.mutateAsync(paper);
      toast.success(`"${paper.title}" saved to your library.`);
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Failed to save paper.");
    }
  }

  const results = search.data?.papers ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
          placeholder="Search arXiv and other academic sources…"
        />
        <Button onClick={() => void handleSearch()} disabled={search.isPending || !query.trim()}>
          {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {search.isPending && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-signal" />
        </div>
      )}

      {!search.isPending && search.isSuccess && results.length === 0 && (
        <p className="py-6 text-center text-sm text-mist">No papers found for &ldquo;{query}&rdquo;.</p>
      )}

      <div className="space-y-3">
        {results.map((paper) => (
          <Card key={paper.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-sm font-medium text-ink">{paper.title}</h3>
                {paper.authors.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-mist">{paper.authors.map((a) => a.name).join(", ")}</p>
                )}
                {paper.abstract && <p className="mt-2 line-clamp-3 text-xs text-mist">{paper.abstract}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>{paper.source}</Badge>
                  {paper.publishedDate && <span className="text-xs text-mist">{paper.publishedDate}</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={savePaper.isPending}
                onClick={() => void handleSave(paper)}
              >
                <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
