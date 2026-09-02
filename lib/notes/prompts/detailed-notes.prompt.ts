/**
 * lib/notes/prompts/detailed-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const DETAILED_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-detailed",
  version: "1.0.0",
  emphasis:
    "Comprehensive coverage. Walk through every topic and subtopic in depth, with full " +
    "explanations, all supporting definitions, worked examples, and formulas. This is the " +
    "'read cover to cover' note type, not a summary — do not skip nuance for brevity.",
  maxOutputTokens: 16384,
});
