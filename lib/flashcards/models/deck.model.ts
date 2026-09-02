/**
 * lib/flashcards/models/deck.model.ts
 * Maps onto `public.flashcard_decks` (0008 + additive 0021 columns).
 */

export type LearningMode =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "exam"
  | "competitive_exam"
  | "revision"
  | "quick_revision"
  | "long_term";

export type SourceType =
  | "pdf"
  | "docx"
  | "txt"
  | "markdown"
  | "ppt"
  | "pptx"
  | "image"
  | "scanned_pdf"
  | "handwritten"
  | "url"
  | "zip"
  | "notes_ai"
  | "assignment_ai"
  | "syllabus_ai"
  | "research_ai"
  | "plain_text";

export interface FlashcardDeck {
  id: string;
  generationId: string;
  title: string;
  cardCount: number;
  learningMode: LearningMode;
  sourceType: SourceType | null;
  sourceRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardDeckRow {
  id: string;
  generation_id: string;
  title: string;
  card_count: number;
  learning_mode: string;
  source_type: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function rowToDeck(row: FlashcardDeckRow): FlashcardDeck {
  return {
    id: row.id,
    generationId: row.generation_id,
    title: row.title,
    cardCount: row.card_count,
    learningMode: row.learning_mode as LearningMode,
    sourceType: row.source_type as SourceType | null,
    sourceRef: row.source_ref,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
