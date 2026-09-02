// lib/assignment/export/exportable-content.ts
// A flattened, format-agnostic bundle of everything an export might include.
// assignment.service.ts / API routes assemble this once, then hand it to
// whichever exporter matches the requested format — keeps every exporter
// (markdown/html/pdf/docx/json/csv) working off the exact same data shape.

import type {
  AssignmentDocument,
  QuestionSolution,
  QuizQuestion,
  Flashcard,
} from "../models/types";

export interface ExportableAssignment {
  document: AssignmentDocument;
  solutions: Map<string, QuestionSolution>; // questionId -> solution
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
  includeSolutions: boolean;
  includeQuizzes: boolean;
  includeFlashcards: boolean;
  includeReferences: boolean;
}
