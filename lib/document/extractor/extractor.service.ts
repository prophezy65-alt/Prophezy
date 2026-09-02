/**
 * lib/document/extractor/extractor.service.ts
 *
 * Calls the AI Core Engine (via the same runStructured pattern used by the
 * Flashcards Engine) to get topics, keywords, definitions, a summary, and a
 * document-type classification in one structured JSON round-trip. Table/
 * code/formula extraction is largely already handled at the provider level
 * (see providers/*.ts + extractor/table-extractor.ts,code-extractor.ts,
 * formula-extractor.ts for the deterministic, non-AI passes).
 */

import { runStructured } from "@/lib/ai/services/_run-structured";
import { smartExtractionPrompt, type SmartExtractionInput } from "./extraction.prompts";
import { validationService } from "../services/validation.service";
import type { SmartExtractionResponse } from "../validation/schemas";
import { chunkText } from "../chunking/chunk-builder";

const MAX_CHARS_PER_EXTRACTION_CALL = 15_000;

export const extractorService = {
  /**
   * For documents longer than one model call can comfortably cover, this
   * extracts per-chunk then merges — topics/keywords are de-duplicated and
   * re-weighted by combined frequency, and only the first chunk's summary
   * call is asked to also classify document type (classification doesn't
   * need the whole document, and running it once avoids conflicting labels).
   */
  async extractSmart(fullText: string, userId: string): Promise<SmartExtractionResponse> {
    const chunks = chunkText(fullText, MAX_CHARS_PER_EXTRACTION_CALL, 300);

    const results = await Promise.all(
      chunks.map((chunk, i) =>
        runStructured<SmartExtractionInput, SmartExtractionResponse>(
          smartExtractionPrompt,
          { userId, input: { text: chunk, isFirstChunk: i === 0 } }
        ).then((r) => validationService.validateSmartExtractionResponse(r))
      )
    );

    if (results.length === 1) return results[0]!;

    return mergeExtractionResults(results);
  },
};

function mergeExtractionResults(results: SmartExtractionResponse[]): SmartExtractionResponse {
  const topicMap = new Map<string, { weight: number; pageIndexes: number[] }>();
  const keywordMap = new Map<string, { frequency: number; weight: number }>();
  const definitions = results.flatMap((r) => r.definitions);

  for (const r of results) {
    for (const t of r.topics) {
      const existing = topicMap.get(t.name.toLowerCase());
      if (existing) {
        existing.weight = Math.max(existing.weight, t.weight);
        existing.pageIndexes.push(...t.pageIndexes);
      } else {
        topicMap.set(t.name.toLowerCase(), { weight: t.weight, pageIndexes: [...t.pageIndexes] });
      }
    }
    for (const k of r.keywords) {
      const existing = keywordMap.get(k.term.toLowerCase());
      if (existing) {
        existing.frequency += k.frequency;
        existing.weight = Math.max(existing.weight, k.weight);
      } else {
        keywordMap.set(k.term.toLowerCase(), { frequency: k.frequency, weight: k.weight });
      }
    }
  }

  return {
    summary: results[0]!.summary,
    // Title/authors only ever come from the first chunk — later chunks are
    // instructed to leave them empty/null (see extraction.prompts.ts), so
    // there's nothing to merge here, just take the first chunk's result.
    title: results[0]!.title,
    authors: results[0]!.authors,
    documentType: results[0]!.documentType,
    documentTypeConfidence: results[0]!.documentTypeConfidence,
    topics: Array.from(topicMap.entries())
      .map(([name, v]) => ({ name, weight: v.weight, pageIndexes: v.pageIndexes }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 50),
    keywords: Array.from(keywordMap.entries())
      .map(([term, v]) => ({ term, frequency: v.frequency, weight: v.weight }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 100),
    definitions: definitions.slice(0, 100),
  };
}
