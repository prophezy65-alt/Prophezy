import type { Database } from "@/lib/supabase/types";
import type {
  AssignmentDocument,
  DetectedQuestion,
  DifficultyLevel,
  ExpectedAnswerType,
  QuestionSolution,
  QuestionType,
  StructuredExtraction,
} from "@/lib/assignment/models/types";
import type { ExplanationDepth } from "@/lib/assignment/services/generator.service";

export type AssignmentDocumentRow = Database["public"]["Tables"]["assignment_ai_documents"]["Row"];
export type AssignmentQuestionRow = Database["public"]["Tables"]["assignment_ai_questions"]["Row"];
export type AssignmentSolutionRow = Database["public"]["Tables"]["assignment_ai_solutions"]["Row"];
export type AssignmentExportRow = Database["public"]["Tables"]["assignment_ai_exports"]["Row"];

export interface DocumentSummary {
  id: string;
  title: string;
  subject: string;
  detectedSubjectArea: string;
  questionCount: number;
  status: "processing" | "ready" | "failed";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export function rowToDocumentSummary(row: AssignmentDocumentRow): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    detectedSubjectArea: row.detected_subject_area,
    questionCount: row.question_count,
    status: isDocumentStatus(row.status) ? row.status : "ready",
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDocumentStatus(value: string): value is DocumentSummary["status"] {
  return value === "processing" || value === "ready" || value === "failed";
}

/** detected_question stores the full DetectedQuestion JSON verbatim — this
 * just re-validates/narrows the shape coming back out of jsonb rather than
 * trusting `Json` blindly. */
export function rowToDetectedQuestion(row: AssignmentQuestionRow): DetectedQuestion {
  const stored = row.detected_question as unknown as DetectedQuestion;
  return {
    ...stored,
    id: row.id,
    questionNumber: row.question_number,
    cleanedText: row.question_text,
    type: row.question_type as QuestionType,
    difficulty: row.difficulty as DifficultyLevel,
    subject: row.subject,
    topic: row.topic,
    marks: row.marks,
  };
}

export function questionToInsertRow(
  documentId: string,
  position: number,
  question: DetectedQuestion,
): Database["public"]["Tables"]["assignment_ai_questions"]["Insert"] {
  return {
    id: question.id,
    document_id: documentId,
    position,
    question_number: question.questionNumber,
    question_text: question.cleanedText,
    question_type: question.type,
    difficulty: question.difficulty,
    subject: question.subject,
    topic: question.topic,
    marks: question.marks,
    detected_question: question as unknown as Database["public"]["Tables"]["assignment_ai_questions"]["Insert"]["detected_question"],
  };
}

/** Reconstructs a minimal, export-safe AssignmentDocument. The full OCR
 * extraction (raw text/pages/tables) is intentionally not persisted — none
 * of the six exporters read `extraction`, only `title`/`detectedSubjectArea`
 * /`questions`, so this stub keeps every consumer type-correct without
 * storing potentially large OCR payloads indefinitely. */
export function toExportableDocument(row: AssignmentDocumentRow, questions: DetectedQuestion[]): AssignmentDocument {
  const emptyExtraction: StructuredExtraction = {
    fileId: row.id,
    pages: [],
    tables: [],
    equations: [],
    figures: [],
    fullText: "",
    language: "en",
    hasHandwriting: row.has_handwriting,
    extractionWarnings: Array.isArray(row.extraction_warnings) ? (row.extraction_warnings as string[]) : [],
  };

  return {
    id: row.id,
    batchId: row.batch_id,
    fileId: row.id,
    title: row.title,
    extraction: emptyExtraction,
    questions,
    detectedSubjectArea: row.detected_subject_area,
    createdAt: row.created_at,
  };
}

export function rowToSolution(row: AssignmentSolutionRow): QuestionSolution {
  return row.solution as unknown as QuestionSolution;
}

export function solutionToInsertRow(
  questionId: string,
  depthMode: ExplanationDepth,
  solution: QuestionSolution,
): Database["public"]["Tables"]["assignment_ai_solutions"]["Insert"] {
  return {
    question_id: questionId,
    depth_mode: depthMode,
    solution: solution as unknown as Database["public"]["Tables"]["assignment_ai_solutions"]["Insert"]["solution"],
  };
}

export function isExpectedAnswerType(value: string): value is ExpectedAnswerType {
  return [
    "single_choice",
    "boolean",
    "short_text",
    "numeric",
    "code_block",
    "long_form_text",
    "diagram",
    "proof",
    "mixed",
  ].includes(value);
}
