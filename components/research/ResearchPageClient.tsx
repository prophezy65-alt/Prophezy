"use client";

import { useState } from "react";
import { Loader2, Library, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { usePapers, useDeletePaper } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { ResearchApiError } from "./researchApi";
import { PaperCard } from "./PaperCard";
import { UploadDropzone } from "./UploadDropzone";
import { PaperDetailPanel } from "./PaperDetailPanel";
import { ChatPanel } from "./ChatPanel";
import { ExternalSearchPanel } from "./ExternalSearchPanel";
import { TopicExplorerPanel } from "./TopicExplorerPanel";
import { ResearchHero } from "./ResearchHero";

type MainTab = "library" | "search" | "topic";

const TABS: { key: MainTab; label: string; icon: typeof Library }[] = [
  { key: "library", label: "Library", icon: Library },
  { key: "search", label: "Search Papers", icon: Search },
  { key: "topic", label: "Topic Explorer", icon: Sparkles },
];

function LibraryTab({
  selectedPaperId,
  onSelectPaper,
}: {
  selectedPaperId: string | null;
  onSelectPaper: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = usePapers(search);
  const deletePaper = useDeletePaper();
  const toast = useResearchToast();

  async function handleDelete(id: string) {
    try {
      await deletePaper.mutateAsync(id);
      toast.success("Paper deleted.");
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Failed to delete paper.");
    }
  }

  const papers = data?.papers ?? [];

  return (
    <div className="space-y-4">
      <UploadDropzone />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter your library by title…" />

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-signal" />
        </div>
      )}

      {!isLoading && papers.length === 0 && (
        <p className="py-8 text-center text-sm text-mist">
          No papers yet — upload a PDF above, or find one under &ldquo;Search Papers&rdquo;.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {papers.map((paper) => (
          <PaperCard
            key={paper.id}
            paper={paper}
            selected={paper.id === selectedPaperId}
            onSelect={() => onSelectPaper(paper.id)}
            onDelete={() => void handleDelete(paper.id)}
            deleting={deletePaper.isPending && deletePaper.variables === paper.id}
          />
        ))}
      </div>
    </div>
  );
}

export function ResearchPageClient() {
  const [tab, setTab] = useState<MainTab>("library");
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [chatOpenFor, setChatOpenFor] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* NEW — colorful stat/quote hero. Everything below this line is
          unchanged from before. */}
      <ResearchHero />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="mb-6 flex items-center">
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === key ? "bg-signal/10 text-signal" : "text-mist hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "library" && <LibraryTab selectedPaperId={selectedPaperId} onSelectPaper={setSelectedPaperId} />}
          {tab === "search" && <ExternalSearchPanel />}
          {tab === "topic" && <TopicExplorerPanel />}
        </div>

        <div className="flex flex-col">
          <div className="mb-6 flex h-[34px] items-center">
            <p className="text-xs font-medium uppercase tracking-wide text-mist">Details</p>
          </div>

          <div className="h-[calc(100vh-220px)] min-h-[400px]">
            {chatOpenFor ? (
              <ChatPanel paperId={chatOpenFor} onClose={() => setChatOpenFor(null)} />
            ) : selectedPaperId ? (
              <PaperDetailPanel
                paperId={selectedPaperId}
                onClose={() => setSelectedPaperId(null)}
                onOpenChat={(id) => setChatOpenFor(id)}
              />
            ) : (
              <Card className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-signal/10">
                  <Library className="h-7 w-7 text-signal" />
                </div>
                <p className="font-display text-base font-medium text-ink">Select a paper</p>
                <p className="max-w-xs text-sm text-mist">
                  Choose a paper from your library to view its summary, citations, or start a grounded chat.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
