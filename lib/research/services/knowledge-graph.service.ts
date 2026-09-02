/**
 * lib/research/services/knowledge-graph.service.ts
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { runKnowledgeGraphExtraction } from "@/lib/ai/services/research-paper.service";
import { getPaper, getPaperSourceText } from "./paper.service";
import { ResearchError, ResearchValidationError } from "../utils/errors";
import { researchLogger } from "../utils/logger";
import { spendCredits, refundCredits, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";
import type { Json } from "@/lib/supabase/types";
import type { ResearchKnowledgeGraphInsert, ResearchKnowledgeGraphRow } from "../models/db.types";

export class KnowledgeGraphError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "KNOWLEDGE_GRAPH_ERROR", cause);
  }
}

const MAX_PAPERS_PER_GRAPH = 12;
const EXCERPT_CHARS_PER_PAPER = 3_000; // keeps N papers comfortably inside one prompt

/**
 * Builds a knowledge graph connecting concepts/methods/findings across the
 * given papers (all must belong to the caller). Each paper contributes a
 * short excerpt (its abstract if present, else the start of its extracted
 * text) rather than its full text, so the prompt stays bounded regardless
 * of how many papers are included.
 *
 * ============================================================================
 * TWO FIXES IN THIS FUNCTION
 * ============================================================================
 * 1. CREDIT GATING — runKnowledgeGraphExtraction() is a real Gemini call
 *    and, like summary/citation generation, was previously unwired from the
 *    credit system entirely. Same spend-eagerly/refund-on-failure pattern
 *    as chat.service.ts.
 * 2. The actual 500 you were likely hitting on this feature is NOT in this
 *    file — it's a migration-ordering bug: 0038_research_knowledge_graphs.sql
 *    creates a trigger that calls `public.touch_updated_at()`, but that
 *    function isn't defined until migration 20260723090100 (which sorts
 *    AFTER 0038 in filename order). If migrations run in filename order and
 *    each file is one transaction, 0038 fails outright and the whole
 *    `research_knowledge_graphs` table — not just the trigger — never gets
 *    created, which is exactly what "GET/POST /api/research/knowledge-graph"
 *    500ing on "relation does not exist" looks like. See the new
 *    reconciliation migration (20260822090000_research_engine_reconcile.sql)
 *    for the fix — it re-creates the table/policies/trigger idempotently and
 *    self-contained (it (re)defines touch_updated_at() itself, so it doesn't
 *    depend on migration order at all).
 */
export async function buildKnowledgeGraph(
  userId: string,
  topic: string,
  paperIds: string[]
): Promise<ResearchKnowledgeGraphRow> {
  if (paperIds.length === 0) {
    throw new ResearchValidationError("At least one paper is required to build a knowledge graph.", ["paperIds"]);
  }
  if (paperIds.length > MAX_PAPERS_PER_GRAPH) {
    throw new ResearchValidationError(`At most ${MAX_PAPERS_PER_GRAPH} papers can be included in one knowledge graph.`, [
      "paperIds",
    ]);
  }

  const papers = await Promise.all(
    paperIds.map(async (id) => {
      const paper = await getPaper(userId, id); // throws PaperNotFoundError if not owned — no cross-user leakage
      const excerpt =
        paper.abstract?.trim() ||
        (await getPaperSourceText(userId, id, { maxChars: EXCERPT_CHARS_PER_PAPER })).text;
      return { id: paper.id, title: paper.title, excerpt: excerpt.slice(0, EXCERPT_CHARS_PER_PAPER) };
    })
  );

  const creditFeature = CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY;
  const creditCost = await getFeatureCreditCost(creditFeature);
  if (!creditCost) {
    throw new KnowledgeGraphError(
      `Research Paper AI knowledge graph is temporarily unavailable (no active credit cost configured for "${creditFeature}").`
    );
  }
  await spendCredits(creditCost.creditCost, creditFeature, "Research paper knowledge graph generation");

  researchLogger.info("knowledge_graph.generation_started", { userId, topic, paperCount: papers.length });

  let result: Awaited<ReturnType<typeof runKnowledgeGraphExtraction>>;
  try {
    result = await runKnowledgeGraphExtraction(userId, { topic, papers });
  } catch (err) {
    await refundCredits(userId, creditCost.creditCost, creditFeature, "Refund: knowledge graph generation failed").catch(() => {});
    throw err;
  }

  const validNodeIds = new Set(result.nodes.map((n) => n.id));
  const edges = result.edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
  if (edges.length !== result.edges.length) {
    researchLogger.warn("knowledge_graph.dropped_dangling_edges", {
      userId,
      topic,
      dropped: result.edges.length - edges.length,
    });
  }

  const supabase = await createClient();
  const insert: ResearchKnowledgeGraphInsert = {
    user_id: userId,
    topic,
    paper_ids: paperIds,
    graph: { nodes: result.nodes, edges },
  };

  const { data, error } = await supabase
    .from("research_knowledge_graphs")
    .insert({ ...insert, graph: insert.graph as unknown as Json })
    .select()
    .single();

  if (error || !data) throw new KnowledgeGraphError("Failed to save knowledge graph.", error?.message);

  researchLogger.info("knowledge_graph.generation_completed", {
    userId,
    graphId: data.id,
    nodeCount: result.nodes.length,
    edgeCount: edges.length,
  });
  return data as unknown as ResearchKnowledgeGraphRow;
}

export async function listKnowledgeGraphs(userId: string): Promise<ResearchKnowledgeGraphRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_knowledge_graphs")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new KnowledgeGraphError("Failed to list knowledge graphs.", error.message);
  return (data ?? []) as unknown as ResearchKnowledgeGraphRow[];
}

export async function deleteKnowledgeGraph(userId: string, graphId: string): Promise<void> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("research_knowledge_graphs")
    .delete({ count: "exact" })
    .eq("id", graphId)
    .eq("user_id", userId);

  if (error) throw new KnowledgeGraphError("Failed to delete knowledge graph.", error.message);
  if (!count) throw new KnowledgeGraphError(`Knowledge graph ${graphId} not found.`);
}
