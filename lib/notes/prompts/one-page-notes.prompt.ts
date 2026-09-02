/**
 * lib/notes/prompts/one-page-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const ONE_PAGE_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-one-page",
  version: "1.0.0",
  emphasis:
    "Must fit on a single printed page. Hard budget: at most 5 topics, each with at most 3 " +
    "keyPoints and no subtopics. Cut anything non-essential rather than shrinking font-of-thought — " +
    "prioritize breadth-of-topic-coverage over depth on any one topic.",
  temperature: 0.3,
  maxOutputTokens: 2048,
});
