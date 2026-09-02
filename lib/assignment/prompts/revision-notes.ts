// lib/assignment/prompts/revision-notes.ts
import { PromptDefinition, withJsonSuffix, isPlainObject, isStringArray } from "./_shared";

export interface RevisionNoteRaw {
  heading: string;
  bulletPoints: string[];
}

export interface RevisionNotesResponse {
  notes: RevisionNoteRaw[];
}

const SCHEMA = `{
  "notes": [{ "heading": string, "bulletPoints": string[] }]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You are a study-notes author. Condense the given source material into structured
revision notes suitable for last-minute exam review.

- Organize into 2-8 headings, each covering one coherent sub-topic.
- Each heading has 3-8 bullet points. Bullets are short, information-dense statements —
  not full sentences padded with filler ("It is important to note that..." is banned).
- Preserve every formula, key term, and specific fact from the source material; do not
  drop technical content for the sake of brevity.
- Order headings in a logical learning sequence (foundational concepts before advanced
  ones), not necessarily the order they appeared in the source.`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const sourceText = typeof input.sourceText === "string" ? input.sourceText : "";
  return `Source material:\n\n${sourceText}`;
}

function validate(parsed: unknown): parsed is RevisionNotesResponse {
  if (!isPlainObject(parsed)) return false;
  if (!Array.isArray(parsed.notes)) return false;
  return parsed.notes.every(
    (n) => isPlainObject(n) && typeof n.heading === "string" && isStringArray(n.bulletPoints)
  );
}

export const revisionNotesPrompt: PromptDefinition<RevisionNotesResponse> = {
  id: "assignment.revision_notes.generate",
  feature: "assignment_notes",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.3,
  maxOutputTokens: 6144,
  validate,
};
