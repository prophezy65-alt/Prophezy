/**
 * lib/notes/prompts/flow-notes.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const FLOW_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-flow",
  version: "1.0.0",
  emphasis:
    "Present processes, algorithms, and sequences as ordered steps. Each relevant topic's " +
    "summary should read as a numbered sequence of steps/stages, and keyPoints should call out " +
    "decision branches or conditions ('if X, then Y') rather than standalone facts.",
  maxOutputTokens: 6144,
});
