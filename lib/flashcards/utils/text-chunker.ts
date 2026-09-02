/**
 * lib/flashcards/utils/text-chunker.ts
 *
 * Splits long ingested documents (books, full syllabi) into model-sized
 * chunks before generation, respecting paragraph boundaries so a card's
 * source excerpt never gets cut mid-sentence. Used by generator.service.ts
 * when `ingested.text.length` exceeds a safe single-call size.
 */

const DEFAULT_CHUNK_CHARS = 12_000; // conservative for Gemini 2.5 Flash context + JSON output budget
const OVERLAP_CHARS = 500; // keeps concepts that straddle a chunk boundary intact

export function chunkText(text: string, chunkChars = DEFAULT_CHUNK_CHARS, overlapChars = OVERLAP_CHARS): string[] {
  if (text.length <= chunkChars) return [text];

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
