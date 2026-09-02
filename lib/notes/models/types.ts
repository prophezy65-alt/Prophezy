/**
 * lib/notes/models/types.ts
 *
 * Domain model for the Notes Intelligence Engine. These types are the
 * vocabulary every service, prompt, and formatter in lib/notes/ shares.
 * They intentionally mirror the AI Core Engine's plain-object style (no
 * classes) so they can be JSON-serialized as-is into Gemini responseSchemas
 * and Supabase jsonb columns.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type SourceKind =
  | "pdf"
  | "docx"
  | "pptx"
  | "txt"
  | "markdown"
  | "image"
  | "scanned_pdf"
  | "handwritten"
  | "url"
  | "plain_text";

export type NoteType =
  | "detailed"
  | "short"
  | "revision"
  | "exam"
  | "one_page"
  | "chapter"
  | "unit"
  | "topic"
  | "lecture"
  | "mindmap"
  | "cheat_sheet"
  | "formula_sheet"
  | "definition_sheet"
  | "key_points"
  | "concept_map"
  | "flow_notes"
  | "comparison_table"
  | "flashcards";

export type LearningMode =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "exam_prep"
  | "revision"
  | "last_minute"
  | "quick_read"
  | "deep_study"
  | "concept_learning"
  | "competitive_exam";

export type OutputStyle =
  | "bullet"
  | "paragraph"
  | "cornell"
  | "outline"
  | "mindmap_structure"
  | "flashcard"
  | "markdown"
  | "html"
  | "rich_text";

export interface SourceDocument {
  /** Upload id if this came through the uploads/OCR pipeline, else undefined for pasted text/URLs. */
  uploadId?: string;
  kind: SourceKind;
  /** Already-extracted plain/markdown text. Parsing (OCR, docx/pptx extraction, URL fetch) happens upstream in lib/notes/parser/. */
  text: string;
  title?: string;
  /** Optional metadata carried through from Syllabus AI / Assignment AI / Research AI when this source came from one of those flows. */
  origin?: {
    module: "syllabus_ai" | "assignment_ai" | "research_ai" | "upload" | "manual";
    refId?: string;
  };
}

export interface NotesGenerationRequest {
  userId: string;
  noteType: NoteType;
  source: SourceDocument;
  learningMode?: LearningMode;
  outputStyle?: OutputStyle;
  /** Narrow generation to a specific topic/chapter within a larger source instead of the whole document. */
  focusTopic?: string;
  /** Target length hint — the model treats this as guidance, not a hard cap. */
  lengthHint?: "very_short" | "short" | "medium" | "long";
  forceRefresh?: boolean;
  requestId?: string;
  /** Optional workspace organization at generation time (0035_notes_workspace.sql). */
  folderId?: string | null;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Shared content atoms (reused across most note types)
// ---------------------------------------------------------------------------

export interface Definition {
  term: string;
  definition: string;
  example?: string;
}

export interface Formula {
  name: string;
  expression: string;
  variables?: { symbol: string; meaning: string }[];
  whenToUse?: string;
}

export interface KeyPoint {
  text: string;
  importance?: "low" | "medium" | "high";
}

export interface ExampleItem {
  title: string;
  explanation: string;
}

export interface Mnemonic {
  forConcept: string;
  device: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface Subtopic {
  title: string;
  summary: string;
  keyPoints?: KeyPoint[];
  definitions?: Definition[];
  examples?: ExampleItem[];
}

export interface Topic {
  title: string;
  summary: string;
  importance?: "low" | "medium" | "high";
  estimatedStudyMinutes?: number;
  subtopics?: Subtopic[];
}

// ---------------------------------------------------------------------------
// Generated output shapes
// ---------------------------------------------------------------------------

/**
 * The common shape returned by every "prose" note type (detailed, short,
 * revision, exam, one_page, chapter, unit, topic, lecture, cheat_sheet,
 * formula_sheet, definition_sheet, key_points, comparison_table). Prompts
 * vary which fields they emphasize; the shape stays constant so
 * generator.service.ts and formatter.service.ts don't need per-type
 * branching logic.
 */
export interface NotesOutput {
  title: string;
  overview: string;
  topics: Topic[];
  keyPoints: KeyPoint[];
  definitions: Definition[];
  formulas: Formula[];
  examples: ExampleItem[];
  mnemonics: Mnemonic[];
  faqs: FAQ[];
  examTips: string[];
  commonMistakes: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedStudyMinutes: number;
}

export interface MindMapNode {
  id: string;
  label: string;
  parentId?: string | null;
}

export interface MindMapEdge {
  from: string;
  to: string;
  label?: string;
}

export interface MindMapOutput {
  title: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  /** Ready-to-render Mermaid `graph TD` definition, generated alongside the structured graph. */
  mermaid: string;
}

export interface FlashCard {
  front: string;
  back: string;
  tags?: string[];
}

export interface FlashcardsOutput {
  title: string;
  cards: FlashCard[];
}

export type NoteGenerationOutput = NotesOutput | MindMapOutput | FlashcardsOutput;

// ---------------------------------------------------------------------------
// Persisted models (shape matches the Part 2 schema; used by services now,
// wired to Supabase once 0007_notes.sql / 0006_document_chunks.sql land)
// ---------------------------------------------------------------------------

/**
 * Persisted note — matches the REAL applied schema (0007_notes.sql +
 * 0035_notes_workspace.sql: `notes.content_md` is markdown text, not a
 * jsonb structured column). `NoteGenerationOutput` above is what the AI
 * returns *before* persistence; `formatter.service.ts`'s `toMarkdown()`
 * flattens it into `contentMd` at save time. From then on, `contentMd` is
 * the single source of truth — edits (auto-save, manual editing) happen at
 * the markdown level, consistent with what's actually stored.
 */
export interface Notes {
  id: string;
  userId: string;
  generationId: string;
  title: string;
  noteType: NoteType;
  learningMode?: LearningMode;
  outputStyle?: OutputStyle;
  folderId: string | null;
  tags: string[];
  isPinned: boolean;
  status: "pending" | "processing" | "ready" | "failed";
  contentMd: string;
  summary: string | null;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotesFolder {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A historical snapshot of a note's content_md, taken automatically right
 * before each content-changing edit (see SupabaseNotesRepository.update()).
 * Append-only — see 0036_notes_version_history.sql.
 */
export interface NoteVersion {
  id: string;
  noteId: string;
  contentMd: string;
  wordCount: number;
  createdAt: string;
}

export interface RevisionPlan {
  id: string;
  notesId: string;
  schedule: { date: string; topics: string[] }[];
}

export interface StudySession {
  id: string;
  userId: string;
  notesId: string;
  startedAt: string;
  endedAt?: string;
  topicsCovered: string[];
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: "topic" | "concept" | "keyword";
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: { from: string; to: string; weight?: number }[];
}

export interface SearchResult {
  notesId: string;
  title: string;
  snippet: string;
  score: number;
  matchType: "semantic" | "keyword" | "topic" | "concept" | "definition" | "formula";
}
