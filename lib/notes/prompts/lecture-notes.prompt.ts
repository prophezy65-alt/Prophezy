/**
 * lib/notes/prompts/lecture-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const LECTURE_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-lecture",
  version: "1.0.0",
  emphasis:
    "Source is a lecture transcript or lecture slide extraction, so it may be conversational, " +
    "repetitive, or out of order. Reconstruct a clean logical topic order rather than following " +
    "the transcript's timeline, and note any asides the lecturer flagged as important " +
    "('this will be on the exam', 'remember this') as high-importance keyPoints.",
  maxOutputTokens: 6144,
});
