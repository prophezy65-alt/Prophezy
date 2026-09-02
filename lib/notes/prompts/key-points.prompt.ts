/**
 * lib/notes/prompts/key-points.prompt.ts
 */
import { createNotesPromptDefinition } from "./_factory";

export const KEY_POINTS_PROMPT = createNotesPromptDefinition({
  feature: "notes-key-points",
  version: "1.0.0",
  emphasis:
    "Only the `keyPoints` array matters here. Extract every point worth remembering as a " +
    "single, self-contained bullet with an importance rating. Everything else can stay sparse.",
  temperature: 0.3,
  maxOutputTokens: 3072,
});
