/**
 * lib/notes/prompts/unit-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const UNIT_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-unit",
  version: "1.0.0",
  emphasis:
    "Treat the source as one syllabus unit spanning multiple chapters/topics. Group `topics` " +
    "at the granularity of distinct chapters within the unit, and use estimatedStudyMinutes per " +
    "topic to help the student plan how to split study time across the unit.",
  maxOutputTokens: 16384,
});
