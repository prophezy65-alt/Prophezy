/**
 * lib/notes/services/formula.service.ts
 *
 * Formula-focused convenience layer: generates a formula sheet via
 * generator.service.ts, and provides lookup helpers over any already-
 * generated note's formulas array (used by search.service.ts's
 * "formula" match type and by a dedicated Formula Sheet view in the UI).
 */

import { generateAndSaveNotes } from "./notes.service";
import type { Formula, NoteGenerationOutput, NotesGenerationRequest, NotesOutput, SourceDocument } from "../models/types";

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "formulas" in content;
}

export async function generateFormulaSheet(params: {
  userId: string;
  source: SourceDocument;
  focusTopic?: string;
}) {
  const request: NotesGenerationRequest = {
    userId: params.userId,
    noteType: "formula_sheet",
    source: params.source,
    focusTopic: params.focusTopic,
  };
  return generateAndSaveNotes(request);
}

/**
 * Flattens every formula out of a set of generation outputs, tagged with
 * which note they came from. Takes explicit `{ notesId, title, content }`
 * tuples rather than persisted `Notes` objects, since structured formulas
 * only exist at generation time (the real schema stores only markdown).
 */
export function collectAllFormulas(
  notesList: { notesId: string; title: string; content: NoteGenerationOutput }[]
): Array<Formula & { notesId: string; notesTitle: string }> {
  const out: Array<Formula & { notesId: string; notesTitle: string }> = [];
  for (const notes of notesList) {
    if (!isProseNotes(notes.content)) continue;
    for (const formula of notes.content.formulas) {
      out.push({ ...formula, notesId: notes.notesId, notesTitle: notes.title });
    }
  }
  return out;
}
