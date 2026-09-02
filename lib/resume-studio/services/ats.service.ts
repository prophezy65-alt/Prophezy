/**
 * ats.service.ts
 * Produces the full AtsReport by combining:
 *  1. Deterministic scoring (resume-score.ts) — instant, free, reproducible.
 *  2. Keyword matching against a job description (resume-keywords.ts).
 *  3. AI-based qualitative analysis via Gemini (weak sentences, grammar,
 *     missing content) — richer but slower/costs a call.
 *
 * The AI portion is optional: `analyzeResume` works fine with just
 * deterministic + keyword signals if `includeAiAnalysis` is false or the
 * Gemini call fails, so the ATS Checker never fully breaks due to AI outages.
 *
 * CREDIT GATING (fixed — this was the reported bug): previously this
 * function had no userId parameter at all, so there was no way to charge
 * for the AI portion — the qualitative analysis ran for free every time.
 * `userId` is now part of AnalyzeResumeOptions. When provided AND
 * includeAiAnalysis is true, RESUME_AI_ANALYSIS (5 credits) is spent
 * BEFORE the Gemini call. The standard spendCreditsForFeature wrapper
 * doesn't fit here because runAiAnalysis() deliberately NEVER throws (it
 * catches its own errors to keep the ATS report resilient to AI outages)
 * — so success/failure is read from its return value (null = failed or
 * skipped) instead of a try/catch, and refunded manually on null.
 *
 * IMPORTANT FOR THE CALLER: if the route/action that calls analyzeResume()
 * doesn't pass `userId` in options, the AI portion now silently skips
 * (falls back to deterministic + keyword scoring only) instead of running
 * for free. That's the correct direction to fail in, but it means the
 * call site MUST be updated to pass userId or ATS AI analysis stops
 * appearing entirely, not just stops being free.
 */

import {
  ResumeContent,
  AtsReport,
  AtsCategory,
  AtsCategoryScore,
  AtsIssue,
  ServiceResult,
  success,
  failure,
} from "../models/resume.model";
import { calculateResumeScore } from "../utils/resume-score";
import { matchKeywords, flattenResumeText } from "../utils/resume-keywords";
import { validateResumeContent } from "../utils/resume-validator";
import { callGeminiJson, GeminiClientError } from "./ai/gemini.client";
import { buildAtsAnalysisPrompt } from "./ai/ai-prompts";
import {
  spendCredits,
  refundCredits,
  getFeatureCreditCost,
  InsufficientCreditsError,
  CREDIT_FEATURES,
} from "@/lib/credits";

interface AiAnalysisShape {
  weakSentences: string[];
  missingContent: string[];
  grammarIssues: string[];
  suggestedKeywords: string[];
}

export interface AnalyzeResumeOptions {
  jobDescription?: string;
  includeAiAnalysis?: boolean;
  /** Required to actually charge for and run the AI portion — see the
   * file-level comment. Omitting this does not make AI analysis free; it
   * makes AI analysis not run at all. */
  userId?: string;
}

async function runAiAnalysis(
  resumeText: string,
  jobDescription?: string
): Promise<AiAnalysisShape | null> {
  try {
    const prompt = buildAtsAnalysisPrompt(resumeText, jobDescription);
    return await callGeminiJson<AiAnalysisShape>(prompt, { temperature: 0.3, maxOutputTokens: 1024 });
  } catch (err) {
    if (err instanceof GeminiClientError) {
      // Non-fatal: ATS report still returns deterministic results.
      return null;
    }
    return null;
  }
}

/**
 * Runs the paid AI portion iff a userId was provided. Returns null (same
 * shape as a failed/disabled AI call) if credits can't be spent, so the
 * caller's existing "AI analysis is optional" handling covers both cases
 * uniformly — no separate error path needed for "insufficient credits" vs
 * "Gemini failed" at this layer. Throws InsufficientCreditsError instead
 * of silently degrading only when the caller explicitly asked for AI
 * analysis but genuinely can't afford it — that's a case the caller
 * should be able to show as INSUFFICIENT_CREDITS, not silently downgrade.
 */
async function runGatedAiAnalysis(
  userId: string,
  resumeText: string,
  jobDescription?: string
): Promise<AiAnalysisShape | null> {
  const feature = CREDIT_FEATURES.RESUME_AI_ANALYSIS;
  const cost = await getFeatureCreditCost(feature);
  if (!cost) return null; // no active cost configured — skip rather than give the AI portion away free

  await spendCredits(cost.creditCost, feature, "ATS/Resume AI analysis"); // throws InsufficientCreditsError if balance too low — propagates to the caller, Gemini is never called

  const result = await runAiAnalysis(resumeText, jobDescription);
  if (result === null) {
    // Gemini call failed internally (runAiAnalysis swallows the error to
    // keep the ATS report resilient) — refund since no real AI analysis
    // was actually produced for the charge taken.
    await refundCredits(userId, cost.creditCost, feature, "Refund: ATS AI analysis failed").catch(() => {});
  }
  return result;
}

export async function analyzeResume(
  content: ResumeContent,
  options: AnalyzeResumeOptions = {}
): Promise<ServiceResult<AtsReport>> {
  const { jobDescription, includeAiAnalysis = true, userId } = options;

  const validationReport = validateResumeContent(content);
  const deterministicScore = calculateResumeScore(content);
  const keywordResult = jobDescription
    ? matchKeywords(content, jobDescription)
    : { matched: [], missing: [], matchPercentage: 100 };

  const resumeText = flattenResumeText(content);

  let aiAnalysis: AiAnalysisShape | null = null;
  if (includeAiAnalysis && userId) {
    try {
      aiAnalysis = await runGatedAiAnalysis(userId, resumeText, jobDescription);
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return failure(err.code, err.message);
      }
      throw err;
    }
  }
  // includeAiAnalysis && !userId: AI portion intentionally skipped — see
  // the file-level comment. Deterministic + keyword report still returns.

  const categoryScores: AtsCategoryScore[] = [];

  // Formatting / validation-derived category
  const formattingIssues: AtsIssue[] = validationReport.issues.map((issue) => ({
    category: "formatting",
    severity: issue.severity === "error" ? "high" : "low",
    message: issue.message,
    location: issue.path,
  }));
  categoryScores.push({
    category: "formatting",
    score: validationReport.isValid ? 90 : 50,
    maxScore: 100,
    issues: formattingIssues,
  });

  // Keyword category
  if (jobDescription) {
    categoryScores.push({
      category: "keywords",
      score: keywordResult.matchPercentage,
      maxScore: 100,
      issues: keywordResult.missing.slice(0, 10).map((kw) => ({
        category: "keywords" as const,
        severity: "medium" as const,
        message: `Missing keyword from job description: "${kw}"`,
        suggestion: `Consider naturally including "${kw}" where truthful.`,
      })),
    });
  }

  // Deterministic writing-quality categories
  for (const breakdown of deterministicScore.breakdown) {
    const category: AtsCategory =
      breakdown.category === "Experience Writing"
        ? "action_verbs"
        : breakdown.category === "Project Writing"
        ? "projects"
        : breakdown.category === "Length"
        ? "length"
        : "sections";
    categoryScores.push({
      category,
      score: breakdown.score,
      maxScore: breakdown.maxScore,
      issues: breakdown.reasons.map((r) => ({
        category,
        severity: breakdown.score < 50 ? ("high" as const) : ("low" as const),
        message: r,
      })),
    });
  }

  // AI-derived qualitative categories
  if (aiAnalysis) {
    categoryScores.push({
      category: "weak_sentences",
      score: Math.max(0, 100 - aiAnalysis.weakSentences.length * 10),
      maxScore: 100,
      issues: aiAnalysis.weakSentences.map((s) => ({
        category: "weak_sentences" as const,
        severity: "medium" as const,
        message: `Weak/vague sentence: "${s}"`,
        suggestion: "Rewrite with a strong action verb and a measurable outcome.",
      })),
    });

    categoryScores.push({
      category: "grammar",
      score: Math.max(0, 100 - aiAnalysis.grammarIssues.length * 15),
      maxScore: 100,
      issues: aiAnalysis.grammarIssues.map((g) => ({
        category: "grammar" as const,
        severity: "high" as const,
        message: g,
      })),
    });

    categoryScores.push({
      category: "missing_content",
      score: Math.max(0, 100 - aiAnalysis.missingContent.length * 10),
      maxScore: 100,
      issues: aiAnalysis.missingContent.map((m) => ({
        category: "missing_content" as const,
        severity: "medium" as const,
        message: m,
      })),
    });
  }

  const overallScore = Math.round(
    categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length
  );

  const matchedKeywords = [...keywordResult.matched, ...(aiAnalysis?.suggestedKeywords ?? [])];
  const missingKeywords = keywordResult.missing;

  const report: AtsReport = {
    overallScore,
    categoryScores,
    matchedKeywords,
    missingKeywords,
    summary: buildSummary(overallScore, categoryScores),
    generatedAt: new Date().toISOString(),
  };

  return success(report);
}

function buildSummary(overallScore: number, categories: AtsCategoryScore[]): string {
  const weakest = [...categories].sort((a, b) => a.score - b.score)[0];
  const tier = overallScore >= 85 ? "excellent" : overallScore >= 65 ? "solid" : "needs work";

  return `Overall ATS score: ${overallScore}/100 (${tier}). Weakest area: ${weakest?.category ?? "n/a"} (${weakest?.score ?? 0}/100).`;
}
