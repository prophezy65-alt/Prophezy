// lib/humanizer/services/grammar.service.ts
import type { GrammarAnalysis } from "../models/types";
import { grammarCheckPrompt } from "../prompts/grammar";
import { runHumanizerPrompt, HumanizerAiError } from "../providers/ai-engine.provider";
import { runHeuristicGrammarScan, computeGrammarScore } from "../utils/grammar-analyzer";
import { logger } from "./_logger";

export interface CheckGrammarOptions {
  userId: string;
}

export interface GrammarCheckOutcome {
  correctedText: string;
  analysis: GrammarAnalysis;
}

export async function checkAndCorrectGrammar(text: string, options: CheckGrammarOptions): Promise<GrammarCheckOutcome> {
  if (text.trim().length === 0) {
    return {
      correctedText: "",
      analysis: { score: 100, issues: [], issueDensityPer100Words: 0 },
    };
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  try {
    const result = await runHumanizerPrompt(grammarCheckPrompt, { text }, { userId: options.userId, routingHint: "flash" });

    const issues = result.issues.map((i) => ({
      originalText: i.originalText,
      suggestion: i.suggestion,
      ruleType: i.ruleType,
    }));

    return {
      correctedText: result.correctedText,
      analysis: {
        score: computeGrammarScore(issues.length, wordCount),
        issues,
        issueDensityPer100Words: round2((issues.length / Math.max(wordCount, 1)) * 100),
      },
    };
  } catch (err) {
    // Degrade to the heuristic-only pass rather than failing outright — the
    // student still gets SOME grammar feedback even if the AI call errors.
    logger.warn("humanizer.grammar.ai_fallback", {
      error: err instanceof HumanizerAiError ? err.message : String(err),
    });

    const heuristicIssues = runHeuristicGrammarScan(text);
    return {
      correctedText: text,
      analysis: {
        score: computeGrammarScore(heuristicIssues.length, wordCount),
        issues: heuristicIssues.map((i) => ({ originalText: i.match, suggestion: i.suggestion, ruleType: i.ruleType })),
        issueDensityPer100Words: round2((heuristicIssues.length / Math.max(wordCount, 1)) * 100),
      },
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
