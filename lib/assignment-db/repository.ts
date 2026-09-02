import { createClient } from "@/lib/supabase/server";
import type { AssignmentDocument, DetectedQuestion, QuestionSolution } from "@/lib/assignment/models/types";
import type { ExplanationDepth } from "@/lib/assignment/services/generator.service";
import {
  questionToInsertRow,
  rowToDetectedQuestion,
  rowToDocumentSummary,
  rowToSolution,
  solutionToInsertRow,
  toExportableDocument,
  type DocumentSummary,
} from "./mappers";

export interface SaveDocumentInput {
  userId: string;
  uploadId: string | null;
  batchId: string;
  document: AssignmentDocument;
  subject: string;
}

export async function saveDocument(input: SaveDocumentInput): Promise<DocumentSummary> {
  const supabase = await createClient();

  const { data: docRow, error: docError } = await supabase
    .from("assignment_ai_documents")
    .insert({
      id: input.document.id,
      user_id: input.userId,
      upload_id: input.uploadId,
      batch_id: input.batchId,
      title: input.document.title,
      subject: input.subject,
      detected_subject_area: input.document.detectedSubjectArea,
      question_count: input.document.questions.length,
      status: "ready",
      extraction_warnings: input.document.extraction.extractionWarnings,
      has_handwriting: input.document.extraction.hasHandwriting,
    })
    .select()
    .single();

  if (docError || !docRow) {
    throw new Error(`Failed to save assignment document: ${docError?.message ?? "unknown error"}`);
  }

  if (input.document.questions.length > 0) {
    const questionRows = input.document.questions.map((q, i) => questionToInsertRow(docRow.id, i, q));
    const { error: questionsError } = await supabase.from("assignment_ai_questions").insert(questionRows);
    if (questionsError) {
      throw new Error(`Failed to save assignment questions: ${questionsError.message}`);
    }
  }

  return rowToDocumentSummary(docRow);
}

export interface ListDocumentsOptions {
  userId: string;
  search?: string;
  subject?: string;
  difficulty?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export interface ListDocumentsResult {
  documents: DocumentSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listDocuments(options: ListDocumentsOptions): Promise<ListDocumentsResult> {
  const supabase = await createClient();

  let matchingIds: string[] | null = null;

  if (options.difficulty) {
    const { data } = await supabase
      .from("assignment_ai_questions")
      .select("document_id")
      .eq("difficulty", options.difficulty);
    matchingIds = Array.from(new Set((data ?? []).map((r) => r.document_id)));
    if (matchingIds.length === 0) {
      return { documents: [], total: 0, page: options.page, pageSize: options.pageSize };
    }
  }

  if (options.search && options.search.trim().length > 0) {
    const term = `%${options.search.trim()}%`;
    const { data } = await supabase.from("assignment_ai_questions").select("document_id").ilike("question_text", term);
    const questionMatchIds = new Set((data ?? []).map((r) => r.document_id));
    matchingIds = matchingIds ? matchingIds.filter((id) => questionMatchIds.has(id)) : null;
    // Title matches are handled by the .or() below; question-text matches are merged after the count query.
  }

  const from = options.page * options.pageSize;
  const to = from + options.pageSize - 1;

  let query = supabase.from("assignment_ai_documents").select("*", { count: "exact" }).eq("user_id", options.userId);

  if (options.subject) {
    query = query.or(`subject.eq.${options.subject},detected_subject_area.eq.${options.subject}`);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (matchingIds) {
    query = query.in("id", matchingIds);
  }
  if (options.search && options.search.trim().length > 0 && !matchingIds) {
    query = query.ilike("title", `%${options.search.trim()}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error) {
    throw new Error(`Failed to list assignment documents: ${error.message}`);
  }

  return {
    documents: (data ?? []).map(rowToDocumentSummary),
    total: count ?? 0,
    page: options.page,
    pageSize: options.pageSize,
  };
}

export interface DocumentDetail {
  summary: DocumentSummary;
  questions: DetectedQuestion[];
  solutions: Record<string, Partial<Record<ExplanationDepth, QuestionSolution>>>;
}

export async function getDocumentDetail(userId: string, documentId: string): Promise<DocumentDetail | null> {
  const supabase = await createClient();

  const { data: docRow, error: docError } = await supabase
    .from("assignment_ai_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (docError || !docRow) return null;

  const { data: questionRows, error: questionsError } = await supabase
    .from("assignment_ai_questions")
    .select("*")
    .eq("document_id", documentId)
    .order("position", { ascending: true });

  if (questionsError) {
    throw new Error(`Failed to load assignment questions: ${questionsError.message}`);
  }

  const questions = (questionRows ?? []).map(rowToDetectedQuestion);

  const solutions: DocumentDetail["solutions"] = {};
  if (questions.length > 0) {
    const { data: solutionRows } = await supabase
      .from("assignment_ai_solutions")
      .select("*")
      .in(
        "question_id",
        questions.map((q) => q.id),
      );
    for (const row of solutionRows ?? []) {
      const depth = row.depth_mode as ExplanationDepth;
      solutions[row.question_id] = { ...solutions[row.question_id], [depth]: rowToSolution(row) };
    }
  }

  return { summary: rowToDocumentSummary(docRow), questions, solutions };
}

/** Builds the export-ready AssignmentDocument shape for a document the
 * caller has already confirmed ownership of via getDocumentDetail. */
export function buildExportableDocument(
  docRow: Parameters<typeof toExportableDocument>[0],
  questions: DetectedQuestion[],
): AssignmentDocument {
  return toExportableDocument(docRow, questions);
}

export async function getDocumentRow(userId: string, documentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_ai_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getQuestion(userId: string, documentId: string, questionId: string): Promise<DetectedQuestion | null> {
  const supabase = await createClient();

  const { data: docRow } = await supabase
    .from("assignment_ai_documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!docRow) return null;

  const { data: questionRow } = await supabase
    .from("assignment_ai_questions")
    .select("*")
    .eq("id", questionId)
    .eq("document_id", documentId)
    .maybeSingle();

  return questionRow ? rowToDetectedQuestion(questionRow) : null;
}

export async function getSolution(questionId: string, depthMode: ExplanationDepth): Promise<QuestionSolution | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_ai_solutions")
    .select("*")
    .eq("question_id", questionId)
    .eq("depth_mode", depthMode)
    .maybeSingle();
  return data ? rowToSolution(data) : null;
}

export async function saveSolution(
  questionId: string,
  depthMode: ExplanationDepth,
  solution: QuestionSolution,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_ai_solutions")
    .upsert(solutionToInsertRow(questionId, depthMode, solution), { onConflict: "question_id,depth_mode" });
  if (error) {
    throw new Error(`Failed to save solution: ${error.message}`);
  }
}

export async function recordExport(userId: string, documentId: string, format: string, fileName: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("assignment_ai_exports").insert({ user_id: userId, document_id: documentId, format, file_name: fileName });
}

export async function listExports(userId: string, documentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assignment_ai_exports")
    .select("*")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteDocument(userId: string, documentId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("assignment_ai_documents")
    .delete({ count: "exact" })
    .eq("id", documentId)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to delete assignment document: ${error.message}`);
  }
  return (count ?? 0) > 0;
}

export async function updateDocumentStatus(documentId: string, status: "processing" | "ready" | "failed", errorMessage?: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("assignment_ai_documents")
    .update({ status, error_message: errorMessage ?? null })
    .eq("id", documentId);
}
