/**
 * lib/notes/prompts/comparison-table-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const COMPARISON_TABLE_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-comparison-table",
  version: "1.0.0",
  emphasis:
    "The source describes two or more comparable things (concepts, methods, eras, structures). " +
    "For each thing being compared, create one entry in `topics` whose subtopics are the " +
    "comparison dimensions (e.g. 'Definition', 'Advantages', 'Use cases'), using parallel " +
    "subtopic titles across every topic so the results line up like a table when rendered.",
  maxOutputTokens: 6144,
});
