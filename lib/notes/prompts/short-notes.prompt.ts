/**
 * lib/notes/prompts/short-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const SHORT_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-short",
  version: "1.0.0",
  emphasis:
    "Compress aggressively. One or two sentences per topic, only the highest-importance " +
    "keyPoints, and skip anything that isn't essential to understanding the core idea.",
  temperature: 0.3,
  maxOutputTokens: 3072,
});
