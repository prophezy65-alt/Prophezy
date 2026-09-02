/**
 * lib/notes/services/summary.service.ts
 *
 * One-line/one-paragraph summaries. Reuses the already-generated
 * `overview` field instead of a fresh AI call when a Notes record already
 * exists; only calls generateNotes (via the "short" note type) when
 * summarizing from raw source text directly, with no prior generation to
 * reuse.
 */

import { generateNotes } from "./generator.service";
import type { Notes, NoteGenerationOutput, NotesGenerationRequest, NotesOutput, SourceDocument } from "../models/types";

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "overview" in content;
}

/**
 * Returns the stored summary for an already-persisted note — no AI call.
 * The real schema (0035_notes_workspace.sql) stores this on `notes.summary`
 * directly (populated from the AI output's `overview` at generation time,
 * regenerable independently via `summarizeSource` below), since only
 * markdown survives persistence — the structured `overview` field only
 * exists in-memory at generation time.
 */
export function summaryFromNotes(notes: Notes): string | null {
  return notes.summary;
}

/** Extracts the `overview` from a fresh (not-yet-persisted) generation result — no AI call. */
export function summaryFromOutput(output: NoteGenerationOutput): string | null {
  return isProseNotes(output) ? output.overview : null;
}

/** Generates a short summary directly from raw source text via the "short" note type. */
export async function summarizeSource(params: {
  userId: string;
  source: SourceDocument;
}): Promise<string> {
  const request: NotesGenerationRequest = {
    userId: params.userId,
    noteType: "short",
    source: params.source,
  };
  const output = await generateNotes(request);
  return isProseNotes(output) ? output.overview : "";
}
