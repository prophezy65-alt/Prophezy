/**
 * lib/notes/prompts/chapter-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const CHAPTER_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-chapter",
  version: "1.0.0",
  emphasis:
    "Treat the source as one chapter of a larger book/course. Structure `topics` to mirror the " +
    "chapter's own section headings where they exist, in original order, with each topic's " +
    "subtopics matching that section's sub-headings.",
  maxOutputTokens: 16384,
});
