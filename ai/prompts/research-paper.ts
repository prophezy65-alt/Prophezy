/**
 * lib/ai/prompts/research-paper.ts
 *
 * Two prompts for work done on an already-uploaded paper's full text (as
 * opposed to research.ts's RESEARCH_PROMPT, which explores a topic from
 * general knowledge + optional source material):
 *   - PAPER_SUMMARY_PROMPT: structured TL;DR/problem/method/results summary
 *   - CITATION_EXTRACTION_PROMPT: pulls references cited *within* the paper
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface PaperSummaryInput {
  title: string;
  authors: string[];
  sourceText: string;
}

export interface PaperSummaryOutput {
  tldr: string;
  problem: string;
  method: string;
  keyResults: string[];
  limitations: string[];
  novelty: string;
}

export const PAPER_SUMMARY_PROMPT: PromptDefinition<PaperSummaryInput, PaperSummaryOutput> = {
  version: "research-paper-summary.v1",
  feature: "research",
  systemPrompt:
    "You are a research assistant summarizing an academic paper for a student who has " +
    "the full text but wants a fast, accurate orientation before reading it closely. " +
    "Base every claim strictly on the provided text — never invent results, numbers, or " +
    "claims the paper doesn't make. If the text is incomplete (e.g. OCR artifacts, a " +
    "cut-off page), summarize what's actually present rather than guessing at what's " +
    "missing. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Title: " + input.title,
      input.authors.length ? "Authors: " + input.authors.join(", ") : "",
      wrapUserContent("paper_text", input.sourceText),
    ]
      .filter(Boolean)
      .join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      tldr: { type: "string" },
      problem: { type: "string" },
      method: { type: "string" },
      keyResults: { type: "array", items: { type: "string" } },
      limitations: { type: "array", items: { type: "string" } },
      novelty: { type: "string" },
    },
    required: ["tldr", "problem", "method", "keyResults", "limitations", "novelty"],
  },
  generation: { temperature: 0.3, maxOutputTokens: 2048 },
};

// ---------------------------------------------------------------------------
// Citation extraction
// ---------------------------------------------------------------------------

export interface CitationExtractionInput {
  sourceText: string;
}

export interface ExtractedCitation {
  rawText: string;
  title: string | null;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string | null;
}

export interface CitationExtractionOutput {
  citations: ExtractedCitation[];
}

/**
 * FIX — this schema previously used `type: ["string", "null"]` /
 * `type: ["number", "null"]` (standard JSON Schema's union-type syntax for
 * "nullable") on title/year/doi/url. Gemini's response_schema is NOT JSON
 * Schema — it's Google's own OpenAPI-3.0-flavored Schema proto, which has
 * no concept of `type` as an array at all. It expects a single scalar
 * `type` plus a separate `nullable: true` boolean for exactly this case.
 * Sending `type: [...]` produced exactly the error you hit: "Unknown name
 * \"type\" at '...properties[1].value': Proto field is not repeating,
 * cannot start list" — the converter hit an array where the proto expects
 * one value. PAPER_SUMMARY_PROMPT and KNOWLEDGE_GRAPH_PROMPT never used
 * this pattern, which is exactly why only citation extraction broke.
 */
export const CITATION_EXTRACTION_PROMPT: PromptDefinition<CitationExtractionInput, CitationExtractionOutput> = {
  version: "research-paper-citations.v2",
  feature: "research",
  systemPrompt:
    "You extract the reference list from an academic paper's text. Only extract citations " +
    "that are actually present in the text — never invent, complete, or guess at a " +
    "reference that isn't there. If the reference list is truncated or missing from the " +
    "provided text, return however many complete citations you can find (possibly zero) " +
    "rather than fabricating the rest. For each citation, extract title/authors/year/DOI/URL " +
    "only when explicitly present in that citation's text — leave a field null rather than " +
    "guessing. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) => wrapUserContent("paper_text", input.sourceText),
  responseSchema: {
    type: "object",
    properties: {
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rawText: { type: "string" },
            title: { type: "string", nullable: true },
            authors: { type: "array", items: { type: "string" } },
            year: { type: "number", nullable: true },
            doi: { type: "string", nullable: true },
            url: { type: "string", nullable: true },
          },
          required: ["rawText", "title", "authors", "year", "doi", "url"],
        },
      },
    },
    required: ["citations"],
  },
  generation: { temperature: 0.1, maxOutputTokens: 4096 },
};

// ---------------------------------------------------------------------------
// Knowledge graph
// ---------------------------------------------------------------------------

export interface KnowledgeGraphExtractionInput {
  topic: string;
  papers: Array<{ id: string; title: string; excerpt: string }>;
}

export interface KnowledgeGraphNodeOutput {
  id: string;
  label: string;
  type: "concept" | "author" | "paper" | "method" | "dataset" | "finding";
}

export interface KnowledgeGraphEdgeOutput {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraphExtractionOutput {
  nodes: KnowledgeGraphNodeOutput[];
  edges: KnowledgeGraphEdgeOutput[];
}

export const KNOWLEDGE_GRAPH_PROMPT: PromptDefinition<KnowledgeGraphExtractionInput, KnowledgeGraphExtractionOutput> = {
  version: "research-knowledge-graph.v1",
  feature: "research",
  systemPrompt:
    "You build a knowledge graph connecting concepts, methods, datasets, findings, and " +
    "authors across a set of academic papers, centered on the given topic. Every node and " +
    "edge must be grounded in what the provided paper excerpts actually say — never invent " +
    "a connection, method, or finding that isn't supported by the text. " +
    "Each paper provided should appear as its own node (type 'paper', id equal to the " +
    "paper's given id, label equal to its title) connected to the concepts/methods/" +
    "findings/authors it actually discusses. Keep the graph focused and readable: prefer " +
    "10-30 nodes total over an exhaustive but cluttered graph. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Topic: " + input.topic,
      "",
      "Papers:",
      ...input.papers.map(
        (p, i) => `\n[Paper ${i + 1}] id="${p.id}" title="${p.title}"\n` + wrapUserContent("excerpt", p.excerpt)
      ),
    ].join("\n"),
  responseSchema: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            type: { type: "string", enum: ["concept", "author", "paper", "method", "dataset", "finding"] },
          },
          required: ["id", "label", "type"],
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source: { type: "string" },
            target: { type: "string" },
            relation: { type: "string" },
          },
          required: ["source", "target", "relation"],
        },
      },
    },
    required: ["nodes", "edges"],
  },
  generation: { temperature: 0.2, maxOutputTokens: 4096 },
};
