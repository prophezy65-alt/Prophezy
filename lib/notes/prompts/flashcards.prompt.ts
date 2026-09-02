/**
 * lib/notes/prompts/flashcards.prompt.ts
 *
 * NOTE: Prophezy's AI Core already has a general-purpose
 * lib/ai/prompts/flashcards.ts + lib/ai/services/flashcard.service.ts.
 * This one is intentionally separate and notes-scoped: it generates flash
 * revision cards *from a specific piece of source content the student is
 * taking notes on* (feature slug "notes-flashcards"), with cards that
 * cross-reference the same terms/definitions this note's NotesOutput would
 * contain, rather than being a standalone flashcard-deck feature. Reuse
 * the existing flashcard service instead of this one for the general
 * "make me flashcards for X" flow.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import type { NotesPromptInput } from "./_factory";
import type { FlashcardsOutput } from "../models/types";

const FLASHCARDS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          front: { type: "string" },
          back: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["front", "back"],
      },
    },
  },
  required: ["title", "cards"],
};

function buildUserPrompt(input: NotesPromptInput): string {
  const parts: string[] = [];
  if (input.sourceTitle) parts.push(`Source title: ${input.sourceTitle}`);
  if (input.focusTopic) parts.push(`Focus only on this topic/chapter: ${input.focusTopic}`);
  parts.push(
    "Generate flash revision cards. Each card should test one atomic fact, definition, " +
      "formula, or concept — never bundle multiple facts into one card. Fronts should be a " +
      "question or term prompt; backs should be a concise, complete answer (1-3 sentences)."
  );
  parts.push("--- SOURCE CONTENT START ---");
  parts.push(input.sourceText);
  parts.push("--- SOURCE CONTENT END ---");
  return parts.join("\n");
}

export const NOTES_FLASHCARDS_PROMPT: PromptDefinition<NotesPromptInput, FlashcardsOutput> = {
  version: "1.0.0",
  feature: "notes-flashcards",
  systemPrompt:
    `You are the Notes Intelligence Engine inside Prophezy, generating flash revision cards ` +
    `from study content. Base every card strictly on the provided source — never invent facts. ` +
    `${JSON_ONLY_SUFFIX}`,
  buildUserPrompt,
  responseSchema: FLASHCARDS_SCHEMA,
  generation: { temperature: 0.35, maxOutputTokens: 4096 },
};
