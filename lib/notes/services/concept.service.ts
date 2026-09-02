/**
 * lib/notes/services/concept.service.ts
 *
 * Builds a KnowledgeGraph (topic-to-subtopic hierarchy + concept
 * co-occurrence edges) directly from already-generated NotesOutput. No new
 * AI call — the structure the generator already extracted (topics ->
 * subtopics, definitions, formulas) is graph-shaped enough to derive this
 * from without asking Gemini a second time for the same information.
 */

import type { KnowledgeGraph, KnowledgeGraphNode, NoteGenerationOutput, NotesOutput } from "../models/types";

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "topics" in content;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Builds a concept graph for one generation's output: topic nodes, subtopic
 * nodes, and definition/keyword nodes linked to the topic that introduced
 * them. Takes the in-flight `NoteGenerationOutput` directly (this structure
 * only exists at generation time — the real schema stores only markdown
 * once persisted).
 */
export function buildConceptGraph(content: NoteGenerationOutput): KnowledgeGraph {
  if (!isProseNotes(content)) {
    return { nodes: [], edges: [] };
  }

  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraph["edges"] = [];
  const seen = new Set<string>();

  const addNode = (node: KnowledgeGraphNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  for (const topic of content.topics) {
    const topicId = `topic:${slug(topic.title)}`;
    addNode({ id: topicId, label: topic.title, type: "topic" });

    for (const sub of topic.subtopics ?? []) {
      const subId = `concept:${slug(sub.title)}`;
      addNode({ id: subId, label: sub.title, type: "concept" });
      edges.push({ from: topicId, to: subId });

      for (const def of sub.definitions ?? []) {
        const defId = `keyword:${slug(def.term)}`;
        addNode({ id: defId, label: def.term, type: "keyword" });
        edges.push({ from: subId, to: defId, weight: 1 });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Merges concept graphs across multiple note sets into one cross-referenced
 * graph, for a "how do my notes connect" view — nodes with the same slug
 * (same topic/term title, case-insensitive) across different notes collapse
 * into a single shared node, so the merge is where cross-references actually
 * surface.
 */
export function mergeConceptGraphs(graphs: KnowledgeGraph[]): KnowledgeGraph {
  const nodeById = new Map<string, KnowledgeGraphNode>();
  const edgeKey = (e: KnowledgeGraph["edges"][number]) => `${e.from}=>${e.to}`;
  const edgeByKey = new Map<string, KnowledgeGraph["edges"][number]>();

  for (const graph of graphs) {
    for (const node of graph.nodes) {
      if (!nodeById.has(node.id)) nodeById.set(node.id, node);
    }
    for (const edge of graph.edges) {
      const key = edgeKey(edge);
      const existing = edgeByKey.get(key);
      if (existing) {
        existing.weight = (existing.weight ?? 1) + (edge.weight ?? 1);
      } else {
        edgeByKey.set(key, { ...edge });
      }
    }
  }

  return { nodes: Array.from(nodeById.values()), edges: Array.from(edgeByKey.values()) };
}
