/**
 * lib/flashcards/models/flashcard.model.ts
 *
 * Maps 1:1 onto `public.flashcards` (0008 + additive 0021 columns).
 * This is the shape every service/provider passes around internally —
 * `flashcards.service.ts` is the only place that talks to Supabase directly,
 * everything else works with `Flashcard`.
 */

export type CardType =
  | "qa"
  | "definition"
  | "term"
  | "formula"
  | "image_concept"
  | "diagram_labels"
  | "code_output"
  | "output_code"
  | "true_false"
  | "fill_blank"
  | "one_word"
  | "concept_recall"
  | "step_ordering"
  | "case_study"
  | "programming_recall"
  | "algorithm_recall"
  | "medical_recall"
  | "legal_recall"
  | "business_recall"
  | "engineering_recall"
  | "vocabulary";

export const CARD_TYPES: readonly CardType[] = [
  "qa",
  "definition",
  "term",
  "formula",
  "image_concept",
  "diagram_labels",
  "code_output",
  "output_code",
  "true_false",
  "fill_blank",
  "one_word",
  "concept_recall",
  "step_ordering",
  "case_study",
  "programming_recall",
  "algorithm_recall",
  "medical_recall",
  "legal_recall",
  "business_recall",
  "engineering_recall",
  "vocabulary",
];

export interface Flashcard {
  id: string;
  deckId: string;
  cardType: CardType;
  front: string;
  back: string;
  position: number;

  // SM-2 scheduling state (0008, native columns)
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string; // ISO timestamp

  // Enrichment (0021, additive)
  tags: string[];
  hint: string | null;
  mnemonic: string | null;
  explanation: string | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
  confidence: number; // 0..1, model's confidence this card is well-formed
  sourceExcerpt: string | null;
  imageUrl: string | null;
  metadata: Record<string, unknown>;
  duplicateOf: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Shape produced by the AI generator, before persistence assigns id/timestamps. */
export interface DraftFlashcard {
  cardType: CardType;
  front: string;
  back: string;
  tags: string[];
  hint?: string | null;
  mnemonic?: string | null;
  explanation?: string | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  sourceExcerpt?: string | null;
  imageUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateFlashcardInput {
  deckId: string;
  draft: DraftFlashcard;
  position?: number;
}

export interface UpdateFlashcardInput {
  id: string;
  front?: string;
  back?: string;
  tags?: string[];
  hint?: string | null;
  mnemonic?: string | null;
  explanation?: string | null;
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

/** Row shape as it actually comes back from Supabase (snake_case). */
export interface FlashcardRow {
  id: string;
  deck_id: string;
  card_type: string;
  front: string;
  back: string;
  position: number;
  ease_factor: string | number;
  interval_days: number;
  repetitions: number;
  due_at: string;
  tags: string[];
  hint: string | null;
  mnemonic: string | null;
  explanation: string | null;
  difficulty: number;
  confidence: string | number;
  source_excerpt: string | null;
  image_url: string | null;
  metadata: Record<string, unknown>;
  duplicate_of: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    deckId: row.deck_id,
    cardType: row.card_type as CardType,
    front: row.front,
    back: row.back,
    position: row.position,
    easeFactor: Number(row.ease_factor),
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    dueAt: row.due_at,
    tags: row.tags ?? [],
    hint: row.hint,
    mnemonic: row.mnemonic,
    explanation: row.explanation,
    difficulty: (row.difficulty ?? 3) as Flashcard["difficulty"],
    confidence: Number(row.confidence ?? 0.5),
    sourceExcerpt: row.source_excerpt,
    imageUrl: row.image_url,
    metadata: row.metadata ?? {},
    duplicateOf: row.duplicate_of,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
