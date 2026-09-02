// lib/humanizer/services/tone.service.ts
import type { ToneProfile } from "../models/types";
import { toneAnalysisPrompt } from "../prompts/tone-analysis";
import { runHumanizerPrompt, HumanizerAiError } from "../providers/ai-engine.provider";
import { analyzeVocabulary, estimateProfessionalismScore } from "../utils/vocabulary-analyzer";
import { logger } from "./_logger";

export interface AnalyzeToneOptions {
  userId: string;
}

export async function analyzeTone(text: string, options: AnalyzeToneOptions): Promise<ToneProfile> {
  if (text.trim().length === 0) {
    return { detectedTone: "mixed", formalityScore: 50, confidenceScore: 0, notes: ["No content to analyze."] };
  }

  try {
    const result = await runHumanizerPrompt(
      toneAnalysisPrompt,
      { text },
      { userId: options.userId, routingHint: "flash" }
    );
    return {
      detectedTone: result.detectedTone,
      formalityScore: result.formalityScore,
      confidenceScore: result.confidenceScore,
      notes: result.notes,
    };
  } catch (err) {
    // Degrade to a deterministic estimate rather than failing the whole
    // rewrite pipeline over a secondary analysis feature.
    logger.warn("humanizer.tone.ai_fallback", {
      error: err instanceof HumanizerAiError ? err.message : String(err),
    });
    const vocab = analyzeVocabulary(text);
    const formalityScore = estimateProfessionalismScore(text, vocab);
    return {
      detectedTone: formalityScore >= 60 ? "formal" : "casual",
      formalityScore,
      confidenceScore: 0.4,
      notes: ["Estimated via deterministic vocabulary heuristics (AI tone analysis unavailable)."],
    };
  }
}
