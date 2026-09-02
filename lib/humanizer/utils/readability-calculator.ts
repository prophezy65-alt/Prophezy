// lib/humanizer/utils/readability-calculator.ts
// Standard, well-established readability formulas — deterministic, no AI
// needed or wanted here since these are defined mathematical formulas.

export interface ReadabilityMetrics {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  averageSentenceLength: number;
  averageSyllablesPerWord: number;
  wordCount: number;
  sentenceCount: number;
  sentenceComplexity: "low" | "moderate" | "high";
}

export function calculateReadability(text: string): ReadabilityMetrics {
  const sentences = splitSentences(text);
  const words = splitWords(text);

  const sentenceCount = Math.max(sentences.length, 1);
  const wordCount = Math.max(words.length, 1);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const averageSentenceLength = wordCount / sentenceCount;
  const averageSyllablesPerWord = syllableCount / wordCount;

  const fleschReadingEase = clamp(
    206.835 - 1.015 * averageSentenceLength - 84.6 * averageSyllablesPerWord,
    0,
    100
  );
  const fleschKincaidGrade = Math.max(
    0,
    0.39 * averageSentenceLength + 11.8 * averageSyllablesPerWord - 15.59
  );

  const sentenceComplexity: ReadabilityMetrics["sentenceComplexity"] =
    averageSentenceLength > 25 ? "high" : averageSentenceLength > 15 ? "moderate" : "low";

  return {
    fleschReadingEase: round2(fleschReadingEase),
    fleschKincaidGrade: round2(fleschKincaidGrade),
    averageSentenceLength: round2(averageSentenceLength),
    averageSyllablesPerWord: round2(averageSyllablesPerWord),
    wordCount: words.length,
    sentenceCount: sentences.length,
    sentenceComplexity,
  };
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

const VOWEL_GROUPS = /[aeiouy]+/g;

function countSyllables(word: string): number {
  const cleaned = word.replace(/[^a-z]/g, "");
  if (cleaned.length === 0) return 1;
  if (cleaned.length <= 3) return 1;

  let normalized = cleaned
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "") // silent e / -es / -ed
    .replace(/^y/, ""); // leading y doesn't count as a vowel start

  const matches = normalized.match(VOWEL_GROUPS);
  const count = matches ? matches.length : 1;
  return Math.max(count, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
