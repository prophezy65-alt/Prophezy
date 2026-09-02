// lib/assignment/models/types.ts
// Core domain types for the Assignment Intelligence Engine.
// These types are consumed by every service, prompt, and export module below.
// No `any` — strict TypeScript throughout.

// ---------------------------------------------------------------------------
// Input / Upload
// ---------------------------------------------------------------------------

export type SupportedMimeCategory =
  | "pdf"
  | "docx"
  | "txt"
  | "markdown"
  | "image"
  | "zip"
  | "pptx"
  | "code";

export interface UploadedAssignmentFile {
  id: string;
  originalName: string;
  mimeType: string;
  category: SupportedMimeCategory;
  sizeBytes: number;
  storagePath: string; // Supabase storage path, resolved by existing upload pipeline
  uploadedAt: string; // ISO timestamp
}

export interface AssignmentUploadBatch {
  batchId: string;
  userId: string;
  files: UploadedAssignmentFile[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// OCR / Extraction
// ---------------------------------------------------------------------------

export type ExtractionSourceType = "native_text" | "ocr_tesseract" | "ocr_gemini_vision";

export interface ExtractedTable {
  id: string;
  caption?: string;
  headers: string[];
  rows: string[][];
  pageNumber?: number;
}

export interface ExtractedEquation {
  id: string;
  raw: string; // original OCR text of the equation
  latex?: string; // normalized LaTeX if the engine could produce it
  pageNumber?: number;
}

export interface ExtractedFigure {
  id: string;
  description: string; // AI-generated description of the figure/diagram/flowchart
  kind: "diagram" | "flowchart" | "figure" | "chart" | "handwriting" | "other";
  pageNumber?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface ExtractedPage {
  pageNumber: number;
  rawText: string;
  confidence: number; // 0-1, OCR confidence for this page (1.0 for native text)
  source: ExtractionSourceType;
}

export interface StructuredExtraction {
  fileId: string;
  pages: ExtractedPage[];
  tables: ExtractedTable[];
  equations: ExtractedEquation[];
  figures: ExtractedFigure[];
  fullText: string; // concatenated, cleaned text across all pages
  language: string; // BCP-47 guess, e.g. "en"
  hasHandwriting: boolean;
  extractionWarnings: string[];
}

// ---------------------------------------------------------------------------
// Question detection & classification
// ---------------------------------------------------------------------------

export type QuestionType =
  | "mcq"
  | "true_false"
  | "fill_in_the_blanks"
  | "one_word"
  | "short_answer"
  | "long_answer"
  | "essay"
  | "case_study"
  | "numerical"
  | "programming"
  | "database"
  | "algorithms"
  | "math"
  | "physics"
  | "chemistry"
  | "ai_ml"
  | "engineering"
  | "business"
  | "medical"
  | "law";

export type DifficultyLevel = "easy" | "medium" | "hard" | "expert";

export type ExpectedAnswerType =
  | "single_choice"
  | "boolean"
  | "short_text"
  | "numeric"
  | "code_block"
  | "long_form_text"
  | "diagram"
  | "proof"
  | "mixed";

export interface DetectedQuestion {
  id: string;
  fileId: string;
  questionNumber: string; // preserves original numbering, e.g. "2(a)", "Q7"
  rawText: string;
  cleanedText: string;
  type: QuestionType;
  marks: number | null;
  difficulty: DifficultyLevel;
  subject: string;
  topic: string;
  subtopic: string | null;
  keywords: string[];
  expectedAnswerType: ExpectedAnswerType;
  programmingLanguage: string | null;
  mcqOptions: string[] | null;
  relatedTableIds: string[];
  relatedEquationIds: string[];
  relatedFigureIds: string[];
  confidence: number; // 0-1 confidence of the classification itself
}

export interface AssignmentDocument {
  id: string;
  batchId: string;
  fileId: string;
  title: string;
  extraction: StructuredExtraction;
  questions: DetectedQuestion[];
  detectedSubjectArea: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// AI Generation outputs
// ---------------------------------------------------------------------------

export interface StepExplanation {
  stepNumber: number;
  title: string;
  explanation: string;
  formula?: string;
  code?: string;
  codeLanguage?: string;
}

export interface QuestionSolution {
  questionId: string;
  explanationOfQuestion: string;
  approach: string;
  steps: StepExplanation[];
  finalAnswer: string;
  keyConcepts: string[];
  mermaidDiagrams: string[]; // raw mermaid syntax blocks
  pseudocode: string | null;
  code: { language: string; content: string } | null;
  references: ReferenceEntry[];
  glossary: GlossaryEntry[];
  generatedAt: string;
  modelUsed: string;
}

export interface ReferenceEntry {
  id: string;
  type: "book" | "paper" | "website" | "standard";
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  url: string | null;
  citationText: string; // formatted citation string
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface RevisionNote {
  heading: string;
  bulletPoints: string[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic: string;
}

export type QuizQuestionType = "mcq" | "true_false" | "short_answer";

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
}

export interface FollowUpPracticeSet {
  questions: string[];
  vivaQuestions: string[];
  interviewQuestions: string[];
}

// ---------------------------------------------------------------------------
// Quality checks
// ---------------------------------------------------------------------------

export interface GrammarIssue {
  offset: number;
  length: number;
  originalText: string;
  suggestion: string;
  ruleType: "grammar" | "spelling" | "punctuation" | "style";
}

export interface CitationIssue {
  referenceId: string;
  issue: string;
  severity: "warning" | "error";
}

export interface DuplicateContentMatch {
  sourceQuestionId: string;
  matchedQuestionId: string;
  similarityScore: number; // 0-1
  matchedSpan: string;
}

export interface ConsistencyIssue {
  description: string;
  locations: string[]; // question IDs or section names involved
  severity: "info" | "warning" | "error";
}

export interface QualityReport {
  documentId: string;
  grammarIssues: GrammarIssue[];
  citationIssues: CitationIssue[];
  duplicateMatches: DuplicateContentMatch[];
  consistencyIssues: ConsistencyIssue[];
  toneAssessment: {
    detectedTone: "casual" | "academic" | "professional" | "mixed";
    suggestions: string[];
  };
  plagiarismAwarenessNote: string; // fixed disclaimer, never a false "checked" claim
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type ExportFormat = "pdf" | "docx" | "markdown" | "html" | "json" | "csv";

export interface ExportRequest {
  documentId: string;
  format: ExportFormat;
  includeSolutions: boolean;
  includeQuizzes: boolean;
  includeFlashcards: boolean;
  includeReferences: boolean;
}

export interface ExportResult {
  format: ExportFormat;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AssignmentAnalyticsEvent {
  userId: string;
  documentId: string;
  eventType:
    | "upload"
    | "ocr_complete"
    | "question_detected"
    | "solution_generated"
    | "quiz_generated"
    | "export"
    | "quality_check";
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface SubjectMasteryStat {
  subject: string;
  topic: string;
  questionsAttempted: number;
  averageDifficulty: number; // 1-4 scale mapped from DifficultyLevel
}
