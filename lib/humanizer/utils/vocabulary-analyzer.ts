// lib/humanizer/utils/vocabulary-analyzer.ts
// Type-token ratio and related deterministic vocabulary metrics.

export interface VocabularyMetrics {
  vocabularyDiversity: number; // type-token ratio (unique words / total words), 0-1
  uniqueWordCount: number;
  totalWordCount: number;
  averageWordLength: number;
  longWordRatio: number; // fraction of words with 7+ characters (a common complexity proxy)
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "to", "of", "in", "on", "at", "by",
  "with", "as", "is", "are", "was", "were", "be", "been", "being", "this", "that", "it",
]);

export function analyzeVocabulary(text: string): VocabularyMetrics {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return { vocabularyDiversity: 0, uniqueWordCount: 0, totalWordCount: 0, averageWordLength: 0, longWordRatio: 0 };
  }

  const uniqueWords = new Set(words);
  const totalLength = words.reduce((sum, w) => sum + w.length, 0);
  const longWords = words.filter((w) => w.length >= 7 && !STOPWORDS.has(w));

  return {
    vocabularyDiversity: round2(uniqueWords.size / words.length),
    uniqueWordCount: uniqueWords.size,
    totalWordCount: words.length,
    averageWordLength: round2(totalLength / words.length),
    longWordRatio: round2(longWords.length / words.length),
  };
}

/** Composite 0-100 "professionalism" proxy derived from vocabulary +
 * structural signals — used alongside (not instead of) the AI tone-analysis
 * prompt, as a fast deterministic cross-check. */
export function estimateProfessionalismScore(text: string, vocab: VocabularyMetrics): number {
  let score = 50;

  score += vocab.longWordRatio * 60; // richer vocabulary nudges professionalism up
  score += vocab.vocabularyDiversity * 20;

  const contractionCount = (text.match(/\b\w+'(t|re|ve|ll|d|s|m)\b/gi) ?? []).length;
  const wordCount = Math.max(vocab.totalWordCount, 1);
  const contractionDensity = contractionCount / wordCount;
  score -= contractionDensity * 100; // contractions read as less formal

  const slangHits = (text.match(/\b(gonna|wanna|kinda|sorta|yeah|dude|awesome|stuff)\b/gi) ?? []).length;
  score -= slangHits * 5;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
