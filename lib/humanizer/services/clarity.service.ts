// lib/humanizer/services/clarity.service.ts
import type { ReadabilityReport } from "../models/types";
import { calculateReadability } from "../utils/readability-calculator";
import { analyzeVocabulary, estimateProfessionalismScore } from "../utils/vocabulary-analyzer";
import { findSentenceFlags, computeConcisenessScore } from "../utils/sentence-optimizer";

/** Computes the full ReadabilityReport for a piece of text. Entirely
 * deterministic (Flesch formulas + vocabulary/sentence heuristics) — no AI
 * call, so this is cheap enough to run on every keystroke-debounced preview
 * if the frontend wants live feedback while a user edits. */
export function analyzeReadability(text: string): ReadabilityReport {
  if (text.trim().length === 0) {
    return {
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      averageSentenceLength: 0,
      averageSyllablesPerWord: 0,
      wordCount: 0,
      sentenceCount: 0,
      clarityScore: 0,
      professionalismScore: 0,
      vocabularyDiversity: 0,
      sentenceComplexity: "low",
    };
  }

  const readability = calculateReadability(text);
  const vocab = analyzeVocabulary(text);
  const flags = findSentenceFlags(text);
  const concisenessScore = computeConcisenessScore(text, flags);
  const professionalismScore = estimateProfessionalismScore(text, vocab);

  // Clarity composite: blends Flesch Reading Ease (normalized), sentence
  // conciseness, and vocabulary diversity — a text that's easy to parse,
  // free of run-ons/filler, and not needlessly repetitive scores highest.
  const clarityScore = Math.round(
    readability.fleschReadingEase * 0.5 + concisenessScore * 0.35 + vocab.vocabularyDiversity * 100 * 0.15
  );

  return {
    fleschReadingEase: readability.fleschReadingEase,
    fleschKincaidGrade: readability.fleschKincaidGrade,
    averageSentenceLength: readability.averageSentenceLength,
    averageSyllablesPerWord: readability.averageSyllablesPerWord,
    wordCount: readability.wordCount,
    sentenceCount: readability.sentenceCount,
    clarityScore: Math.min(100, Math.max(0, clarityScore)),
    professionalismScore,
    vocabularyDiversity: vocab.vocabularyDiversity,
    sentenceComplexity: readability.sentenceComplexity,
  };
}

export { findSentenceFlags } from "../utils/sentence-optimizer";
