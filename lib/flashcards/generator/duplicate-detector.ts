/**
 * lib/flashcards/generator/duplicate-detector.ts
 *
 * Two layers of dedup:
 *  1. `findLexicalDuplicates` — fast, local, token-overlap based (Jaccard),
 *     used immediately after generation before anything hits the DB.
 *  2. `findSemanticDuplicates` — for existing decks, compares pgvector
 *     embeddings (cosine similarity) via concept.service.ts, since two cards
 *     can be near-duplicates with completely different wording.
 */

import type { DraftFlashcard } from "../models/flashcard.model";

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface LexicalDuplicatePair {
  indexA: number;
  indexB: number;
  similarity: number;
}

/**
 * Compares every card's (front + back) against every other in the same
 * batch. O(n^2) but n is bounded by targetCardCount (<=200 by validation),
 * so this stays well under a millisecond-scale operation.
 */
export function findLexicalDuplicates(
  cards: DraftFlashcard[],
  threshold = 0.75
): LexicalDuplicatePair[] {
  const tokenSets = cards.map((c) => tokenize(`${c.front} ${c.back}`));
  const pairs: LexicalDuplicatePair[] = [];

  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const sim = jaccard(tokenSets[i]!, tokenSets[j]!);
      if (sim >= threshold) {
        pairs.push({ indexA: i, indexB: j, similarity: sim });
      }
    }
  }

  return pairs;
}

/**
 * Drops the later duplicate in each pair, keeping the earlier (usually
 * higher-confidence, since generation tends to front-load stronger cards).
 */
export function dedupeDraftCards(cards: DraftFlashcard[], threshold = 0.75): DraftFlashcard[] {
  const duplicates = findLexicalDuplicates(cards, threshold);
  const toDrop = new Set(duplicates.map((p) => p.indexB));
  return cards.filter((_, i) => !toDrop.has(i));
}

export interface SemanticDuplicateCandidate {
  flashcardId: string;
  similarity: number;
}

/**
 * Cosine similarity between two pgvector embeddings, used by
 * concept.service.ts when checking a new card against existing deck cards
 * fetched with their `embedding` column already populated.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
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

export function findSemanticDuplicates(
  candidateEmbedding: number[],
  existing: { id: string; embedding: number[] }[],
  threshold = 0.92
): SemanticDuplicateCandidate[] {
  return existing
    .map((e) => ({ flashcardId: e.id, similarity: cosineSimilarity(candidateEmbedding, e.embedding) }))
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
