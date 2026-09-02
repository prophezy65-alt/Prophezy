/**
 * lib/document/analysis/analysis.service.ts
 *
 * Deterministic, non-AI analysis (language detection, reading level,
 * complexity, sentiment) — cheap enough to run on every document without
 * a model call. Document TYPE classification (academic_paper/resume/etc.)
 * comes from extractor.service.ts's AI call instead, since that genuinely
 * needs semantic understanding; this service merges the two into one
 * `DocumentAnalysis` record.
 */

import type { DocumentAnalysis } from "../models/analysis.model";
import type { DocumentTypeLabel } from "../types/document.types";
import { detectLanguage } from "./language-detector";
import { computeComplexity } from "./complexity-analyzer";
import { estimateReadingTimeMinutes } from "./reading-time";

// Small, dependency-free sentiment lexicon — good enough for a coarse
// positive/neutral/negative/mixed signal on study/work documents, which are
// rarely emotionally charged; not intended as a general-purpose classifier.
const POSITIVE_WORDS = new Set([
  "excellent", "great", "success", "improve", "benefit", "advantage",
  "achieve", "effective", "positive", "strong", "growth", "innovative",
]);
const NEGATIVE_WORDS = new Set([
  "fail", "failure", "problem", "issue", "weak", "decline", "risk",
  "negative", "poor", "error", "limitation", "concern",
]);

export const analysisService = {
  analyze(text: string, documentType: DocumentTypeLabel, documentTypeConfidence: number): DocumentAnalysis {
    const words = text.trim().length ? text.trim().split(/\s+/) : [];
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3);

    const lang = detectLanguage(text);
    const complexity = computeComplexity(text, words, sentences);
    const sentiment = analyzeSentiment(words);

    return {
      documentType,
      documentTypeConfidence,
      language: lang.language,
      languageConfidence: lang.confidence,
      readingLevel: complexity.readingLevel,
      fleschKincaidGrade: complexity.fleschKincaidGrade,
      complexityScore: complexity.complexityScore,
      sentiment: sentiment.label,
      sentimentScore: sentiment.score,
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageSentenceLength: sentences.length > 0 ? Number((words.length / sentences.length).toFixed(1)) : 0,
    };
  },

  estimateReadingTimeMinutes,
};

function analyzeSentiment(words: string[]): { label: DocumentAnalysis["sentiment"]; score: number } {
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    const lower = w.toLowerCase().replace(/[^a-z]/g, "");
    if (POSITIVE_WORDS.has(lower)) pos++;
    if (NEGATIVE_WORDS.has(lower)) neg++;
  }

  const total = pos + neg;
  if (total === 0) return { label: "neutral", score: 0 };

  const score = (pos - neg) / total;
  if (pos > 0 && neg > 0 && Math.abs(score) < 0.3) return { label: "mixed", score };
  if (score > 0.15) return { label: "positive", score };
  if (score < -0.15) return { label: "negative", score };
  return { label: "neutral", score };
}
