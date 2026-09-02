/**
 * lib/document/chunking/chunking.service.ts
 */

import { buildChunks, estimateTokens } from "./chunk-builder";
import type { ChunkStrategy } from "../types/document.types";
import type { Section } from "../models/section.model";
import type { Chunk } from "../models/chunk.model";

export interface BuildDocumentChunksInput {
  documentId: string;
  text: string;
  sections: Section[];
  strategy: ChunkStrategy;
  maxChars?: number;
  overlapChars?: number;
}

export const chunkingService = {
  buildDocumentChunks(input: BuildDocumentChunksInput): Chunk[] {
    const raw = buildChunks(
      input.strategy,
      { text: input.text, sections: input.sections },
      { maxChars: input.maxChars, overlapChars: input.overlapChars }
    );

    return raw.map((c, i) => ({
      id: `${input.documentId}_chunk_${i}`,
      documentId: input.documentId,
      index: i,
      text: c.text,
      strategy: input.strategy,
      startPageIndex: 0, // page-accurate offsets require per-page char mapping upstream; left as a documented follow-up
      endPageIndex: 0,
      tokenEstimate: estimateTokens(c.text),
      metadata: { startCharOffset: c.startCharOffset, endCharOffset: c.endCharOffset },
    }));
  },
};
