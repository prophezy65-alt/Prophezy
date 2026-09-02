/**
 * lib/notes/prompts/revision-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const REVISION_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-revision",
  version: "1.0.0",
  emphasis:
    "Written for someone who has already studied this once and is refreshing memory before " +
    "an exam. Prioritize keyPoints, definitions, mnemonics, and commonMistakes over long " +
    "explanations. Keep topic summaries to 1-2 sentences — the value is in the keyPoints array.",
  temperature: 0.35,
  maxOutputTokens: 4096,
});
