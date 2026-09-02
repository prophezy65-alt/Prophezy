/**
 * lib/notes/prompts/formula-sheet.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const FORMULA_SHEET_PROMPT = createNotesPromptDefinition({
  feature: "notes-formula-sheet",
  version: "1.0.0",
  emphasis:
    "The `formulas` array is the entire point of this note type — extract every formula, " +
    "equation, and theorem statement in the source, each with its variables explained and a " +
    "one-line note on when to use it. Other fields (topics, examples) should stay minimal, " +
    "just enough to give each formula context.",
  temperature: 0.2,
  maxOutputTokens: 4096,
});
