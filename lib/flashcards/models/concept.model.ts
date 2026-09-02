/**
 * lib/flashcards/models/concept.model.ts
 * Maps onto `public.flashcard_concepts` (additive, 0021).
 * Also home to the shared `Topic` and `Difficulty` type aliases the spec
 * calls out as separate models — they're views over the same table/field,
 * not separate storage.
 */

export type ConceptKind = "concept" | "topic" | "keyword" | "formula" | "date" | "name";

export interface Concept {
  id: string;
  deckId: string;
  name: string;
  kind: ConceptKind;
  weight: number;
  cardIds: string[];
  createdAt: string;
}

/** `Topic` is a `Concept` with kind === "topic" — kept as a type alias so
 *  callers can import the name the spec expects without duplicating storage. */
export type Topic = Concept;

export interface ConceptRow {
  id: string;
  deck_id: string;
  name: string;
  kind: string;
  weight: string | number;
  card_ids: string[];
  created_at: string;
}

export function rowToConcept(row: ConceptRow): Concept {
  return {
    id: row.id,
    deckId: row.deck_id,
    name: row.name,
    kind: row.kind as ConceptKind,
    weight: Number(row.weight),
    cardIds: row.card_ids ?? [],
    createdAt: row.created_at,
  };
}

/** `Difficulty` model — a computed classification, not a stored row. */
export interface Difficulty {
  level: 1 | 2 | 3 | 4 | 5;
  label: "very_easy" | "easy" | "moderate" | "hard" | "very_hard";
  reasoning: string;
}

export const DIFFICULTY_LABELS: Record<Difficulty["level"], Difficulty["label"]> = {
  1: "very_easy",
  2: "easy",
  3: "moderate",
  4: "hard",
  5: "very_hard",
};
