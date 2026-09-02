/**
 * lib/notes/prompts/definition-sheet.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const DEFINITION_SHEET_PROMPT = createNotesPromptDefinition({
  feature: "notes-definition-sheet",
  version: "1.0.0",
  emphasis:
    "The `definitions` array is the entire point of this note type — extract every term, " +
    "concept name, and piece of jargon introduced in the source with a precise definition and " +
    "a short example of use. Do not skip terms just because they seem basic.",
  temperature: 0.2,
  maxOutputTokens: 4096,
});
