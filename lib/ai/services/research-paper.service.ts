/**
 * lib/ai/services/research-paper.service.ts
 */
import { runStructured } from "./_run-structured";
import {
  PAPER_SUMMARY_PROMPT,
  CITATION_EXTRACTION_PROMPT,
  KNOWLEDGE_GRAPH_PROMPT,
  type PaperSummaryInput,
  type PaperSummaryOutput,
  type CitationExtractionInput,
  type CitationExtractionOutput,
  type KnowledgeGraphExtractionInput,
  type KnowledgeGraphExtractionOutput,
} from "../prompts/research-paper";

export function runPaperSummary(
  userId: string,
  input: PaperSummaryInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<PaperSummaryOutput> {
  return runStructured(PAPER_SUMMARY_PROMPT, { userId, input, ...opts });
}

export function runCitationExtraction(
  userId: string,
  input: CitationExtractionInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<CitationExtractionOutput> {
  return runStructured(CITATION_EXTRACTION_PROMPT, { userId, input, ...opts });
}

export function runKnowledgeGraphExtraction(
  userId: string,
  input: KnowledgeGraphExtractionInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<KnowledgeGraphExtractionOutput> {
  return runStructured(KNOWLEDGE_GRAPH_PROMPT, { userId, input, ...opts });
}
