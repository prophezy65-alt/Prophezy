/**
 * lib/notes/services/mindmap.service.ts
 *
 * Thin, mindmap-specific convenience layer over notes.service.ts. Exists
 * because mind maps have a distinct output shape (MindMapOutput) that
 * callers often want without going through the generic Notes wrapper type —
 * this unwraps it for them while still going through the same
 * generate -> validate -> format -> persist pipeline as every other note type.
 */

import { generateAndSaveNotes } from "./notes.service";
import type { MindMapOutput, NotesGenerationRequest, SourceDocument } from "../models/types";

export interface GenerateMindMapParams {
  userId: string;
  source: SourceDocument;
  focusTopic?: string;
  forceRefresh?: boolean;
}

export async function generateMindMap(params: GenerateMindMapParams) {
  const request: NotesGenerationRequest = {
    userId: params.userId,
    noteType: "mindmap",
    source: params.source,
    focusTopic: params.focusTopic,
    forceRefresh: params.forceRefresh,
  };

  const result = await generateAndSaveNotes(request);
  return {
    notes: result.notes,
    mindMap: result.output as MindMapOutput,
    mermaid: (result.output as MindMapOutput).mermaid,
  };
}
