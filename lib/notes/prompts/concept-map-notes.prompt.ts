/**
 * lib/notes/prompts/concept-map-notes.prompt.ts
 *
 * Text-form concept map: unlike mindmap.prompt.ts (which returns a graph
 * structure for rendering), this returns the standard NotesOutput shape
 * organized so subtopics read as "concept -> related concept" chains,
 * for contexts that want prose rather than a diagram.
 */
import { createNotesPromptDefinition } from "./_factory";

export const CONCEPT_MAP_NOTES_PROMPT = createNotesPromptDefinition({
  feature: "notes-concept-map",
  version: "1.0.0",
  emphasis:
    "Organize topics around how concepts relate to and depend on each other, not the source's " +
    "original ordering. Each topic summary should explicitly name which other concepts it " +
    "builds on or connects to, so the reader can trace the concept structure by reading in order.",
  maxOutputTokens: 6144,
});
