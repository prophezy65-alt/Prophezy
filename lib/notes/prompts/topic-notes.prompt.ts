/**
 * lib/notes/prompts/topic-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const TOPIC_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-topic",
  version: "1.0.0",
  emphasis:
    "Narrow, deep focus on a single named topic (see focusTopic in the prompt input) rather " +
    "than the whole source. Return exactly one entry in `topics`, but make its `subtopics` " +
    "thorough — this note type trades breadth for depth on one idea.",
  maxOutputTokens: 6144,
});
