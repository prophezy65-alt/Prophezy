/**
 * lib/research/services/citation.service.ts
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { runCitationExtraction } from "@/lib/ai/services/research-paper.service";
import { getPaper, getPaperSourceText, MAX_CITATION_SOURCE_CHARS } from "./paper.service";
import { ResearchError } from "../utils/errors";
import { researchLogger } from "../utils/logger";
import { spendCredits, refundCredits, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";
import { withCache, buildCacheKey, CACHE_TTL } from "@/lib/ai/utils/response-cache";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/ai/middleware/rate-limit";
import { FEATURE_MODEL_MAP } from "@/lib/ai/config/models";
import type { ResearchCitationInsert, ResearchCitationRow } from "../models/db.types";

export class CitationExtractionError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "CITATION_EXTRACTION_ERROR", cause);
  }
}

export class CitationRateLimitedError extends ResearchError {
  constructor(public retryAfterSeconds: number) {
    super(`You're extracting citations too quickly. Try again in ${retryAfterSeconds}s.`, "RATE_LIMITED");
  }
}

/** Lists previously extracted citations for a paper the user owns. */
export async function listCitations(userId: string, paperId: string): Promise<ResearchCitationRow[]> {
  await getPaper(userId, paperId); // ownership check — throws PaperNotFoundError if not owned
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("research_citations")
    .select()
    .eq("paper_id", paperId)
    .order("created_at", { ascending: true })
    .returns<ResearchCitationRow[]>();

  if (error) throw new CitationExtractionError("Failed to load citations.", error.message);
  return data ?? [];
}

/**
 * Extracts citations from the paper's reference section (or abstract, if
 * no full text is available — usually yields nothing, which is correct)
 * and replaces any previously extracted set for this paper.
 *
 * SCALE FIX — same pair of additions as summary.service.ts (see that
 * file's comment for the full rationale): a per-paper-text cache (citation
 * extraction is deterministic content -> content, not per-user) and a
 * per-user rate limit, independent of Gemini's own throttling.
 */
export async function extractCitations(userId: string, paperId: string): Promise<{ citations: ResearchCitationRow[]; cacheHit: boolean }> {
  try {
    await enforceRateLimit(userId, "research");
  } catch (err) {
    if (err instanceof RateLimitExceededError) throw new CitationRateLimitedError(err.retryAfterSeconds);
    throw err;
  }

  const paper = await getPaper(userId, paperId);
  const { text: sourceText } = await getPaperSourceText(userId, paperId, {
    preferTail: true,
    maxChars: MAX_CITATION_SOURCE_CHARS,
  });

  if (!sourceText.trim()) {
    throw new CitationExtractionError("This paper has no extracted text to extract citations from. Upload the PDF first.");
  }

  const creditFeature = CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY;
  const creditCost = await getFeatureCreditCost(creditFeature);
  if (!creditCost) {
    throw new CitationExtractionError(
      `Research Paper AI citation extraction is temporarily unavailable (no active credit cost configured for "${creditFeature}").`
    );
  }
  await spendCredits(creditCost.creditCost, creditFeature, "Research paper citation extraction");

  researchLogger.info("citations.extraction_started", { userId, paperId });

  const cacheKey = buildCacheKey("citations", FEATURE_MODEL_MAP.research!, { sourceText });

  let result: Awaited<ReturnType<typeof runCitationExtraction>>;
  let cacheHit: boolean;
  try {
    const cached = await withCache(cacheKey, CACHE_TTL.PAPER_CITATIONS, () => runCitationExtraction(userId, { sourceText }));
    result = cached.result;
    cacheHit = cached.cacheHit;
  } catch (err) {
    await refundCredits(userId, creditCost.creditCost, creditFeature, "Refund: research citation extraction failed").catch(() => {});
    throw err;
  }

  const supabase = await createClient();

  // Replace-on-regenerate: a paper's citation list should reflect the
  // latest extraction, not accumulate duplicates across re-runs — applies
  // whether this run was a cache hit or a real extraction.
  const { error: deleteError } = await supabase.from("research_citations").delete().eq("paper_id", paperId);
  if (deleteError) throw new CitationExtractionError("Failed to clear previous citations.", deleteError.message);

  if (result.citations.length === 0) {
    researchLogger.info("citations.extraction_completed", { userId, paperId, count: 0, cacheHit });
    return { citations: [], cacheHit };
  }

  const inserts: ResearchCitationInsert[] = result.citations.map((c) => ({
    paper_id: paperId,
    raw_text: c.rawText,
    title: c.title,
    authors: c.authors,
    year: c.year,
    doi: c.doi,
    url: c.url,
  }));

  const { data, error } = await supabase.from("research_citations").insert(inserts).select().returns<ResearchCitationRow[]>();
  if (error || !data) throw new CitationExtractionError("Failed to save extracted citations.", error?.message);

  researchLogger.info("citations.extraction_completed", { userId, paperId, count: data.length, cacheHit });
  return { citations: data, cacheHit };
}
