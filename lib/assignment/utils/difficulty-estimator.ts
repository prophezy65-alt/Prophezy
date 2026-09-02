// lib/assignment/utils/difficulty-estimator.ts
// Deterministic heuristic difficulty scorer. Used to (a) sanity-check the
// AI-assigned difficulty and (b) provide a fallback when AI classification
// confidence is low, without ever hardcoding subject-specific logic —
// scoring is driven purely by structural/linguistic signals of the text.

import type { DifficultyLevel } from "../models/types";

const HIGH_COGNITIVE_VERBS = [
  "analyze", "evaluate", "critique", "synthesize", "derive", "prove", "justify",
  "design", "optimize", "compare and contrast", "formulate", "construct",
];

const LOW_COGNITIVE_VERBS = [
  "define", "list", "state", "identify", "name", "recall", "what is", "who is",
];

export interface DifficultySignals {
  wordCount: number;
  marks: number | null;
  containsMultiPartStructure: boolean; // e.g. "(a) ... (b) ... (c) ..."
  highCognitiveVerbCount: number;
  lowCognitiveVerbCount: number;
  containsMathNotation: boolean;
  containsCodeRequirement: boolean;
}

export function extractDifficultySignals(questionText: string, marks: number | null): DifficultySignals {
  const lower = questionText.toLowerCase();
  const wordCount = questionText.trim().split(/\s+/).filter(Boolean).length;

  const highCognitiveVerbCount = HIGH_COGNITIVE_VERBS.reduce(
    (count, verb) => count + (lower.includes(verb) ? 1 : 0),
    0
  );
  const lowCognitiveVerbCount = LOW_COGNITIVE_VERBS.reduce(
    (count, verb) => count + (lower.includes(verb) ? 1 : 0),
    0
  );

  const containsMultiPartStructure = /\([a-z]\)\s*.+\([a-z]\)/is.test(questionText);
  const containsMathNotation = /[∑∫√π≤≥≠±∞]|\b(?:d\/dx|lim|matrix|derivative|integral)\b/i.test(questionText);
  const containsCodeRequirement = /\b(write a (?:function|program|method|class)|implement|code snippet)\b/i.test(lower);

  return {
    wordCount,
    marks,
    containsMultiPartStructure,
    highCognitiveVerbCount,
    lowCognitiveVerbCount,
    containsMathNotation,
    containsCodeRequirement,
  };
}

export function estimateDifficulty(signals: DifficultySignals): DifficultyLevel {
  let score = 0;

  // Marks weighting (most reliable signal when present)
  if (signals.marks !== null) {
    if (signals.marks >= 15) score += 3;
    else if (signals.marks >= 8) score += 2;
    else if (signals.marks >= 4) score += 1;
  }

  // Length as a proxy for complexity
  if (signals.wordCount > 120) score += 2;
  else if (signals.wordCount > 60) score += 1;

  score += signals.highCognitiveVerbCount * 1.5;
  score -= signals.lowCognitiveVerbCount * 1;

  if (signals.containsMultiPartStructure) score += 1;
  if (signals.containsMathNotation) score += 1;
  if (signals.containsCodeRequirement) score += 1;

  if (score >= 6) return "expert";
  if (score >= 3.5) return "hard";
  if (score >= 1) return "medium";
  return "easy";
}

/** Reconciles the AI-suggested difficulty with the heuristic estimate. If
 * they disagree by more than one level, we trust the heuristic less than the
 * AI (which has full semantic understanding) but flag it for analytics. */
export function reconcileDifficulty(
  aiSuggested: DifficultyLevel,
  heuristic: DifficultyLevel
): { final: DifficultyLevel; disagreement: boolean } {
  const order: DifficultyLevel[] = ["easy", "medium", "hard", "expert"];
  const aiIndex = order.indexOf(aiSuggested);
  const heuristicIndex = order.indexOf(heuristic);
  const disagreement = Math.abs(aiIndex - heuristicIndex) >= 2;
  return { final: aiSuggested, disagreement };
}
