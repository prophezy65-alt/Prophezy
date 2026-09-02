/**
 * lib/flashcards/generator/card-generator.ts
 *
 * Turns ingested text into a validated `GenerationResponse` (deck title +
 * concepts + draft cards) by calling the AI Core Engine through
 * services/_run-structured.ts. This is the only file that decides *which*
 * prompt to use based on requested card types / learning mode.
 */

import { runStructured } from "@/lib/ai/services/_run-structured";
import {
  FLASHCARD_PROMPTS_BY_FEATURE,
  generalFlashcardPrompt,
  type FlashcardGenerationInput,
} from "../prompts/flashcards.prompts";
import { validationService } from "../validation/validation.service";
import type { GenerationResponse } from "../validation/schemas";
import type { CardType, LearningMode } from "../models";

const CARD_TYPE_TO_PROMPT_FEATURE: Partial<Record<CardType, keyof typeof FLASHCARD_PROMPTS_BY_FEATURE>> = {
  concept_recall: "concept",
  definition: "definition",
  formula: "formula",
  code_output: "programming",
  output_code: "programming",
  programming_recall: "programming",
  algorithm_recall: "programming",
  medical_recall: "medical",
  engineering_recall: "engineering",
};

function choosePrompt(cardTypes: CardType[], learningMode: LearningMode) {
  if (learningMode === "revision" || learningMode === "quick_revision") {
    return FLASHCARD_PROMPTS_BY_FEATURE.revision!;
  }
  if (learningMode === "exam" || learningMode === "competitive_exam") {
    return FLASHCARD_PROMPTS_BY_FEATURE.exam!;
  }

  // If every requested type maps to the same specialized prompt, use it;
  // otherwise fall back to the general mixed-type generator.
  const features = new Set(
    cardTypes.map((t) => CARD_TYPE_TO_PROMPT_FEATURE[t]).filter(Boolean)
  );
  if (features.size === 1) {
    const [only] = Array.from(features);
    return FLASHCARD_PROMPTS_BY_FEATURE[only!]!;
  }
  return generalFlashcardPrompt;
}

export interface GenerateCardsParams {
  userId: string;
  sourceText: string;
  learningMode: LearningMode;
  targetCardCount: number;
  cardTypes: CardType[];
  subjectHint?: string;
}

export async function generateCards(params: GenerateCardsParams): Promise<GenerationResponse> {
  const prompt = choosePrompt(params.cardTypes, params.learningMode);

  const input: FlashcardGenerationInput = {
    sourceText: params.sourceText,
    learningMode: params.learningMode,
    targetCardCount: params.targetCardCount,
    cardTypes: params.cardTypes,
    subjectHint: params.subjectHint,
  };

  const result = await runStructured(prompt, { userId: params.userId, input });

  return validationService.validateGenerationResponse(result);
}
