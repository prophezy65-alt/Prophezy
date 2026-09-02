/**
 * lib/ai/services/research-paper.service.ts
 *
 * Credit-gated in Phase 4: RESEARCH_PAPER_AI_QUERY (2 credits) per call —
 * both runPaperSummary and runCitationExtraction are separate real Gemini
 * calls, so each is gated independently rather than only the first one.
 */
import { runStructured } from "./_run-structured";
import {
  PAPER_SUMMARY_PROMPT,
  CITATION_EXTRACTION_PROMPT,
  type PaperSummaryInput,
  type PaperSummaryOutput,
  type CitationExtractionInput,
  type CitationExtractionOutput,
} from "../prompts/research-paper";
import { spendCreditsForFeature, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";

async function requireCost(feature: string): Promise<number> {
  const cost = await getFeatureCreditCost(feature);
  if (!cost) {
    throw new Error(`Research Paper AI is temporarily unavailable (no active credit cost configured for "${feature}").`);
  }
  return cost.creditCost;
}

export async function runPaperSummary(
  userId: string,
  input: PaperSummaryInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<PaperSummaryOutput> {
  const feature = CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY;
  const creditCost = await requireCost(feature);
  return spendCreditsForFeature(
    userId,
    creditCost,
    feature,
    () => runStructured(PAPER_SUMMARY_PROMPT, { userId, input, ...opts }),
    "Research paper summary"
  );
}

export async function runCitationExtraction(
  userId: string,
  input: CitationExtractionInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<CitationExtractionOutput> {
  const feature = CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY;
  const creditCost = await requireCost(feature);
  return spendCreditsForFeature(
    userId,
    creditCost,
    feature,
    () => runStructured(CITATION_EXTRACTION_PROMPT, { userId, input, ...opts }),
    "Research paper citation extraction"
  );
}
