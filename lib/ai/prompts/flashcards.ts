/**
 * lib/ai/prompts/flashcards.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface FlashcardsInput {
  sourceText: string;
  count?: number;
}

export interface FlashcardsOutput {
  cards: { front: string; back: string; tag?: string }[];
}

export const FLASHCARDS_PROMPT: PromptDefinition<FlashcardsInput, FlashcardsOutput> = {
  version: "flashcards.v1",
  feature: "flashcards",
  systemPrompt:
    "You convert study material into spaced-repetition flashcards. Each card " +
    "tests exactly one atomic fact or concept — never bundle multiple facts " +
    "into one card. Fronts should be genuine questions/prompts, not just a " +
    "term; backs should be concise (1-2 sentences). " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      wrapUserContent("source_text", input.sourceText),
      "Generate approximately " + (input.count ?? 15) + " flashcards.",
    ].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string" },
            back: { type: "string" },
            tag: { type: "string" },
          },
          required: ["front", "back"],
        },
      },
    },
    required: ["cards"],
  },
  generation: { temperature: 0.4, maxOutputTokens: 3072 },
};
