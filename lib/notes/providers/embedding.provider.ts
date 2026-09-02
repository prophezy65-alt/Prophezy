/**
 * lib/notes/providers/embedding.provider.ts
 *
 * Thin wrapper around AI Core's `embed()` (per the AI Core README: "client.ts
 * — Low-level Gemini REST wrapper: generate(), streamGenerate(), embed()").
 * I don't have client.ts's exact `embed()` signature, so this file isolates
 * the assumption in one place — if the real signature differs, this is the
 * only file that needs to change, not every caller in search.service.ts.
 *
 * Reuse note: this deliberately does NOT call Gemini directly. It imports
 * `embed` from the existing lib/ai/config/client.ts, same as engine.ts does
 * for generate()/streamGenerate().
 */

import { embed } from "../../ai/config/client";

export interface EmbeddingResult {
  vector: number[];
  model: string;
}

/** Embeds a single piece of text for storage or query. */
export async function embedText(text: string): Promise<EmbeddingResult> {
  const vector = await embed(text);
  return { vector, model: "text-embedding-004" };
}

/**
 * Embeds many chunks. Sequential by default to respect the same rate
 * limiting AI Core already enforces on generate() calls — parallelize at
 * the call site with care (e.g. small batches) if throughput matters more
 * than staying under a shared per-user rate limit.
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  for (const text of texts) {
    results.push(await embedText(text));
  }
  return results;
}

/** Cosine similarity between two equal-length vectors, for scoring/testing outside pgvector. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
