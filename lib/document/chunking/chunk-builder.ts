/**
 * lib/document/chunking/chunk-builder.ts
 *
 * Three real strategies, all pure functions:
 *  - recursive: splits on paragraph -> sentence -> word boundaries, only
 *    descending a level when a chunk is still too big (LangChain's
 *    RecursiveCharacterTextSplitter approach, reimplemented dependency-free).
 *  - semantic: groups paragraphs by heading section first (keeps a
 *    section's content together as long as it fits), then falls back to
 *    recursive within an oversized section.
 *  - sliding_window: fixed-size windows with configurable overlap, the
 *    simplest and most predictable of the three.
 */

import { DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP } from "../constants/limits";
import { ChunkingError } from "../errors/document-errors";
import type { ChunkStrategy } from "../types/document.types";
import type { Section } from "../models/section.model";

export interface TextChunk {
  text: string;
  startCharOffset: number;
  endCharOffset: number;
}

/** Simple char-budget splitter used by the Flashcards Engine and reused here for plain text. */
export function chunkText(text: string, chunkChars = DEFAULT_CHUNK_CHARS, overlapChars = DEFAULT_CHUNK_OVERLAP): string[] {
  if (text.length <= chunkChars) return text.length ? [text] : [];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > chunkChars && current.length > 0) {
      chunks.push(current);
      const tail = current.slice(-overlapChars);
      current = tail + "\n\n" + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitOnSeparators(text: string, separators: string[], maxChars: number): string[] {
  if (text.length <= maxChars || separators.length === 0) {
    return hardSplit(text, maxChars);
  }

  const [sep, ...rest] = separators;
  const parts = sep ? text.split(sep) : [text];

  const merged: string[] = [];
  let buffer = "";

  for (const part of parts) {
    const candidate = buffer ? buffer + sep + part : part;
    if (candidate.length > maxChars && buffer) {
      merged.push(buffer);
      buffer = part;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) merged.push(buffer);

  return merged.flatMap((m) => (m.length > maxChars ? splitOnSeparators(m, rest, maxChars) : [m]));
}

function hardSplit(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars));
  return out;
}

/** Recursive strategy: paragraph -> sentence -> word, descending only as needed. */
export function chunkRecursive(text: string, maxChars = DEFAULT_CHUNK_CHARS, overlapChars = DEFAULT_CHUNK_OVERLAP): TextChunk[] {
  const rawChunks = splitOnSeparators(text, ["\n\n", "\n", ". ", " "], maxChars);
  return applyOverlap(rawChunks, text, overlapChars);
}

/** Sliding window: fixed windows with overlap, no semantic awareness. */
export function chunkSlidingWindow(text: string, windowChars = DEFAULT_CHUNK_CHARS, overlapChars = DEFAULT_CHUNK_OVERLAP): TextChunk[] {
  if (overlapChars >= windowChars) {
    throw new ChunkingError("Overlap must be smaller than the window size.", { windowChars, overlapChars });
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + windowChars, text.length);
    chunks.push({ text: text.slice(start, end), startCharOffset: start, endCharOffset: end });
    if (end >= text.length) break;
    start = end - overlapChars;
  }

  return chunks;
}

/** Semantic strategy: keep sections intact where possible, recurse within oversized ones. */
export function chunkSemantic(sections: Section[], maxChars = DEFAULT_CHUNK_CHARS, overlapChars = DEFAULT_CHUNK_OVERLAP): TextChunk[] {
  const chunks: TextChunk[] = [];
  let offset = 0;

  for (const section of sections) {
    const sectionText = [
      section.heading?.text,
      ...section.blocks.map((b) => (b.type === "paragraph" ? b.data.text : b.data.items.join("\n"))),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!sectionText.trim()) continue;

    if (sectionText.length <= maxChars) {
      chunks.push({ text: sectionText, startCharOffset: offset, endCharOffset: offset + sectionText.length });
    } else {
      const sub = chunkRecursive(sectionText, maxChars, overlapChars);
      for (const s of sub) {
        chunks.push({ text: s.text, startCharOffset: offset + s.startCharOffset, endCharOffset: offset + s.endCharOffset });
      }
    }
    offset += sectionText.length + 2;
  }

  return chunks;
}

function applyOverlap(rawChunks: string[], fullText: string, overlapChars: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let searchFrom = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const piece = rawChunks[i]!;
    const withOverlap = i === 0 ? piece : rawChunks[i - 1]!.slice(-overlapChars) + piece;
    const startCharOffset = fullText.indexOf(piece, searchFrom);
    const resolvedStart = startCharOffset >= 0 ? startCharOffset : searchFrom;
    const endCharOffset = resolvedStart + piece.length;
    chunks.push({ text: withOverlap, startCharOffset: resolvedStart, endCharOffset });
    searchFrom = endCharOffset;
  }

  return chunks;
}

/** Rough token estimate (chars/4), consistent with lib/ai/utils/tokens.ts's fast local estimator per your README. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildChunks(
  strategy: ChunkStrategy,
  input: { text: string; sections?: Section[] },
  options: { maxChars?: number; overlapChars?: number } = {}
): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_CHUNK_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_CHUNK_OVERLAP;

  switch (strategy) {
    case "recursive":
      return chunkRecursive(input.text, maxChars, overlapChars);
    case "sliding_window":
      return chunkSlidingWindow(input.text, maxChars, overlapChars);
    case "semantic":
      if (!input.sections || input.sections.length === 0) {
        return chunkRecursive(input.text, maxChars, overlapChars);
      }
      return chunkSemantic(input.sections, maxChars, overlapChars);
    default:
      throw new ChunkingError(`Unknown chunk strategy: ${strategy}`);
  }
}
