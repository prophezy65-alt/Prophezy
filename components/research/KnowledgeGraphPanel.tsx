"use client";

import { useState } from "react";
import { Loader2, Network, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePapers, useKnowledgeGraphs, useBuildKnowledgeGraph, useDeleteKnowledgeGraph } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { ResearchApiError } from "./researchApi";

const NODE_TYPE_COLORS: Record<string, string> = {
  concept: "border-signal/40 text-signal",
  author: "border-blue-400/40 text-blue-300",
  paper: "border-emerald-400/40 text-emerald-300",
  method: "border-amber-400/40 text-amber-300",
  dataset: "border-purple-400/40 text-purple-300",
  finding: "border-pink-400/40 text-pink-300",
};

export function KnowledgeGraphPanel() {
  const [topic, setTopic] = useState("");
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const papers = usePapers("");
  const graphs = useKnowledgeGraphs();
  const build = useBuildKnowledgeGraph();
  const remove = useDeleteKnowledgeGraph();
  const toast = useResearchToast();

  function togglePaper(id: string) {
    setSelectedPaperIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleBuild() {
    if (!topic.trim() || selectedPaperIds.length === 0) {
      toast.error("Pick a topic name and at least one paper.");
      return;
    }
    try {
      await build.mutateAsync({ topic: topic.trim(), paperIds: selectedPaperIds });
      toast.success("Knowledge graph built.");
      setSelectedPaperIds([]);
      setTopic("");
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Failed to build knowledge graph.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Failed to delete graph.");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <h3 className="font-display text-sm font-medium text-ink">Build a new graph</h3>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic name, e.g. Transformer architectures" />
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
          {(papers.data?.papers ?? []).length === 0 && <p className="p-2 text-xs text-mist">No papers in your library yet.</p>}
          {(papers.data?.papers ?? []).map((paper) => (
            <label key={paper.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-surface">
              <input
                type="checkbox"
                checked={selectedPaperIds.includes(paper.id)}
                onChange={() => togglePaper(paper.id)}
                className="accent-signal"
              />
              <span className="truncate text-ink">{paper.title}</span>
            </label>
          ))}
        </div>
        <Button size="sm" onClick={() => void handleBuild()} disabled={build.isPending}>
          {build.isPending ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Building…
            </>
          ) : (
            <>
              <Network className="mr-2 h-3.5 w-3.5" /> Build graph
            </>
          )}
        </Button>
      </Card>

      {graphs.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-signal" />
        </div>
      )}

      <div className="space-y-4">
        {(graphs.data?.graphs ?? []).map((graph) => (
          <Card key={graph.id} className="p-4">
            <div className="mb-3 flex items-start justify-between">
              <h3 className="font-display text-sm font-medium text-ink">{graph.topic}</h3>
              <button
                onClick={() => void handleDelete(graph.id)}
                className="rounded p-1 text-mist hover:bg-surface hover:text-red-400"
                aria-label="Delete graph"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {graph.graph.nodes.map((node) => (
                <Badge key={node.id} className={NODE_TYPE_COLORS[node.type] ?? ""}>
                  {node.label}
                </Badge>
              ))}
            </div>

            <ul className="space-y-1">
              {graph.graph.edges.map((edge, i) => {
                const source = graph.graph.nodes.find((n) => n.id === edge.source);
                const target = graph.graph.nodes.find((n) => n.id === edge.target);
                return (
                  <li key={i} className="text-xs text-mist">
                    <span className="text-ink">{source?.label ?? edge.source}</span> —{" "}
                    <span className="italic">{edge.relation}</span> →{" "}
                    <span className="text-ink">{target?.label ?? edge.target}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
