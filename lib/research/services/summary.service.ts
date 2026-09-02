/**
 * lib/research/services/summary.service.ts
 */
import "server-only";
import { runPaperSummary } from "@/lib/ai/services/research-paper.service";
import { getPaper, getPaperSourceText, saveSummary, MAX_SUMMARY_SOURCE_CHARS } from "./paper.service";
import { ResearchError } from "../utils/errors";
import { researchLogger } from "../utils/logger";
import { spendCredits, refundCredits, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";
import { withCache, buildCacheKey, CACHE_TTL } from "@/lib/ai/utils/response-cache";
import { enforceRateLimit, RateLimitExceededError } from "@/lib/ai/middleware/rate-limit";
import { FEATURE_MODEL_MAP } from "@/lib/ai/config/models";
import type { PaperSummaryOutput } from "@/lib/ai/prompts/research-paper";
import type { ResearchPaperRow } from "../models/db.types";

export class SummaryGenerationError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "SUMMARY_GENERATION_ERROR", cause);
  }
}

export class SummaryRateLimitedError extends ResearchError {
  constructor(public retryAfterSeconds: number) {
    super(`You're generating summaries too quickly. Try again in ${retryAfterSeconds}s.`, "RATE_LIMITED");
  }
}

function toMarkdown(summary: PaperSummaryOutput): string {
  const lines = [
    `**TL;DR:** ${summary.tldr}`,
    "",
    "### Problem",
    summary.problem,
    "",
    "### Method",
    summary.method,
    "",
    "### Key Results",
    ...summary.keyResults.map((r) => `- ${r}`),
    "",
    "### Limitations",
    ...(summary.limitations.length ? summary.limitations.map((l) => `- ${l}`) : ["- None noted."]),
    "",
    "### Novelty",
    summary.novelty,
  ];
  return lines.join("\n");
}

export interface GenerateSummaryResult {
  paper: ResearchPaperRow;
  structured: PaperSummaryOutput;
  cacheHit: boolean;
}

/**
 * Generates (or regenerates, with forceRefresh) a structured summary for a
 * paper the user owns and persists it as markdown on the paper row.
 *
 * ============================================================================
 * SCALE FIX — response caching + per-user rate limiting
 * ============================================================================
 * Two independent additions, both aimed at "5,000 users without hitting
 * Gemini's limits":
 *   1. CACHE: the summary of a given paper's text is deterministic content
 *      -> content, not per-user — two students summarizing the same paper
 *      should never both hit Gemini. Cached by a hash of the actual source
 *      text + model id, for 30 days (see response-cache.ts). forceRefresh
 *      bypasses the cache on read but still repopulates it, so a manual
 *      "regenerate" doesn't get stuck serving a stale cached copy forever.
 *   2. RATE LIMIT: bounds how many summaries any single user can trigger
 *      per hour, independent of Gemini's own throttling — stops one user
 *      (or a retry loop) from starving everyone else's shared quota.
 * Credits are still spent on both a cache hit and a genuine Gemini call —
 * the student received the value either way; only a genuine miss reaches
 * Gemini and therefore only a miss can be refunded on failure (a cache hit
 * can't fail in a way Gemini would need refunding for).
 */
export async function generatePaperSummary(
  userId: string,
  paperId: string,
  opts: { forceRefresh?: boolean } = {}
): Promise<GenerateSummaryResult> {
  try {
    await enforceRateLimit(userId, "research");
  } catch (err) {
    if (err instanceof RateLimitExceededError) throw new SummaryRateLimitedError(err.retryAfterSeconds);
    throw err;
  }

  const paper = await getPaper(userId, paperId);
  const { text: sourceText, hasFullText } = await getPaperSourceText(userId, paperId, { maxChars: MAX_SUMMARY_SOURCE_CHARS });

  if (!sourceText.trim()) {
    throw new SummaryGenerationError(
      "This paper has no extracted text or abstract to summarize yet. Upload the PDF or wait for processing to finish."
    );
  }

  const creditFeature = CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY;
  const creditCost = await getFeatureCreditCost(creditFeature);
  if (!creditCost) {
    throw new SummaryGenerationError(
      `Research Paper AI summary is temporarily unavailable (no active credit cost configured for "${creditFeature}").`
    );
  }
  await spendCredits(creditCost.creditCost, creditFeature, "Research paper summary generation");

  researchLogger.info("summary.generation_started", { userId, paperId, hasFullText });

  const cacheKey = buildCacheKey("summary", FEATURE_MODEL_MAP.research, { title: paper.title, sourceText });

  let structured: PaperSummaryOutput;
  let cacheHit: boolean;
  try {
    if (opts.forceRefresh) {
      structured = await runPaperSummary(userId, { title: paper.title, authors: paper.authors, sourceText }, {
        forceRefresh: true,
      });
      cacheHit = false;
    } else {
      const cached = await withCache(cacheKey, CACHE_TTL.PAPER_SUMMARY, () =>
        runPaperSummary(userId, { title: paper.title, authors: paper.authors, sourceText }, { forceRefresh: false })
      );
      structured = cached.result;
      cacheHit = cached.cacheHit;
    }
  } catch (err) {
    await refundCredits(userId, creditCost.creditCost, creditFeature, "Refund: research summary generation failed").catch(() => {});
    throw err;
  }

  const updated = await saveSummary(userId, paperId, toMarkdown(structured));

  researchLogger.info("summary.generation_completed", { userId, paperId, cacheHit });
  return { paper: updated, structured, cacheHit };
}
