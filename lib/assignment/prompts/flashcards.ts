// lib/assignment/prompts/flashcards.ts
import { PromptDefinition, withJsonSuffix, isPlainObject } from "./_shared";

export interface FlashcardRaw {
  front: string;
  back: string;
  topic: string;
}

export interface FlashcardResponse {
  flashcards: FlashcardRaw[];
}

const SCHEMA = `{
  "flashcards": [{ "front": string, "back": string, "topic": string }]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You are a spaced-repetition flashcard author for a student revision tool.

Given source material (a question+solution, a topic summary, or raw notes), produce
atomic flashcards:
- front: ONE clear question or prompt. No compound questions ("what is X and how does Y
  work" should be two separate cards).
- back: a concise, correct answer — a sentence or two, not a paragraph. Long-form
  explanation belongs in revision notes, not flashcards.
- topic: the specific subtopic this card belongs to, for grouping/filtering.

Produce between 3 and 12 cards depending on how much distinct testable content the
source material actually contains — never pad with redundant or trivial cards just to
hit a number, and never produce fewer than the material supports.`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const sourceText = typeof input.sourceText === "string" ? input.sourceText : "";
  const maxCards = typeof input.maxCards === "number" ? input.maxCards : 12;
  return `Source material:\n\n${sourceText}\n\nGenerate at most ${maxCards} flashcards.`;
}

function validate(parsed: unknown): parsed is FlashcardResponse {
  if (!isPlainObject(parsed)) return false;
  if (!Array.isArray(parsed.flashcards)) return false;
  return parsed.flashcards.every(
    (c) => isPlainObject(c) && typeof c.front === "string" && typeof c.back === "string" && typeof c.topic === "string"
  );
}

export const flashcardsPrompt: PromptDefinition<FlashcardResponse> = {
  id: "assignment.flashcards.generate",
  feature: "assignment_flashcards",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.4,
  maxOutputTokens: 4096,
  validate,
};
