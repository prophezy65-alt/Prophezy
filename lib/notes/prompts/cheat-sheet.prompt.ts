/**
 * lib/notes/prompts/cheat-sheet.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const CHEAT_SHEET_PROMPT = createNotesPromptDefinition({
  feature: "notes-cheat-sheet",
  version: "1.0.0",
  emphasis:
    "Reference-card density. Favor formulas, definitions, and terse keyPoints written as " +
    "quick-lookup fragments (not full sentences) over prose explanations or examples.",
  temperature: 0.3,
  maxOutputTokens: 3072,
});
