/**
 * lib/syllabus/services/exam-prediction-history.service.ts
 *
 * Persists every Exam Predictor run so a user can come back to it later
 * (or delete it) instead of losing the result the moment they navigate
 * away. Backed by the `exam_predictions` table — see
 * lib/syllabus/migrations/0001_exam_predictions.sql.
 *
 * TYPING NOTE: `exam_predictions` is a brand-new table that won't exist in
 * lib/supabase/types.ts (the generated Database type) until the migration
 * above is applied to the real project and types are regenerated. Rather
 * than hand-edit that ~4000-line generated file and risk a mismatch, this
 * service goes through the client untyped for this one table only
 * (`as unknown as UntypedClient`). Once you've run
 * `supabase gen types typescript ... > lib/supabase/types.ts`, you can
 * drop the cast and get full type-safety here for free.
 */

import { createClient } from "@/lib/supabase/server";
import type { ExtractedSyllabus, PaperPrediction, PyqMapResult } from "../models/syllabus.types";

export interface ExamPredictionRecord {
  id: string;
  userId: string;
  subjectName: string;
  questionCountRequested: number;
  previousPapersUsed: number;
  syllabus: ExtractedSyllabus;
  prediction: PaperPrediction;
  pyqMap: PyqMapResult | null;
  warnings: string[];
  createdAt: string;
}

export type ExamPredictionSummary = Pick<
  ExamPredictionRecord,
  "id" | "subjectName" | "questionCountRequested" | "previousPapersUsed" | "createdAt"
>;

interface ExamPredictionRow {
  id: string;
  user_id: string;
  subject_name: string;
  question_count_requested: number;
  previous_papers_used: number;
  syllabus: ExtractedSyllabus;
  prediction: PaperPrediction;
  pyq_map: PyqMapResult | null;
  warnings: string[];
  created_at: string;
}

function toRecord(row: ExamPredictionRow): ExamPredictionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    subjectName: row.subject_name,
    questionCountRequested: row.question_count_requested,
    previousPapersUsed: row.previous_papers_used,
    syllabus: row.syllabus,
    prediction: row.prediction,
    pyqMap: row.pyq_map,
    warnings: row.warnings ?? [],
    createdAt: row.created_at,
  };
}

/** Untyped escape hatch — see the TYPING NOTE at the top of this file. */
async function untypedTable(table: "exam_predictions") {
  const supabase = await createClient();
  return (supabase as unknown as { from: (t: string) => any }).from(table);
}

export async function saveExamPrediction(
  userId: string,
  data: {
    syllabus: ExtractedSyllabus;
    prediction: PaperPrediction;
    pyqMap: PyqMapResult | null;
    previousPapersUsed: number;
    questionCountRequested: number;
    warnings: string[];
  },
): Promise<string> {
  const table = await untypedTable("exam_predictions");
  const { data: inserted, error } = await table
    .insert({
      user_id: userId,
      subject_name: data.syllabus.subjectName || "Untitled subject",
      question_count_requested: data.questionCountRequested,
      previous_papers_used: data.previousPapersUsed,
      syllabus: data.syllabus,
      prediction: data.prediction,
      pyq_map: data.pyqMap,
      warnings: data.warnings,
    })
    .select("id")
    .single();

  if (error) {
    // Saving is best-effort — the analysis itself already succeeded and
    // the caller already has the result in hand, so a storage failure
    // shouldn't fail the whole request. Log it and let the caller decide
    // whether to surface a soft warning.
    console.error("[exam-prediction-history] save failed", error);
    throw new Error(`Couldn't save this prediction to your history: ${error.message}`);
  }

  return inserted.id as string;
}

/** Newest first, lightweight fields only — for the history list view. */
export async function listExamPredictions(userId: string): Promise<ExamPredictionSummary[]> {
  const table = await untypedTable("exam_predictions");
  const { data, error } = await table
    .select("id, subject_name, question_count_requested, previous_papers_used, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Couldn't load exam prediction history: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    subjectName: row.subject_name,
    questionCountRequested: row.question_count_requested,
    previousPapersUsed: row.previous_papers_used,
    createdAt: row.created_at,
  }));
}

/** Full saved record, for reopening a past prediction. Returns null if it doesn't exist or isn't this user's. */
export async function getExamPrediction(userId: string, id: string): Promise<ExamPredictionRecord | null> {
  const table = await untypedTable("exam_predictions");
  const { data, error } = await table.select("*").eq("id", id).eq("user_id", userId).maybeSingle();

  if (error) throw new Error(`Couldn't load that prediction: ${error.message}`);
  if (!data) return null;
  return toRecord(data as ExamPredictionRow);
}

/** Returns true if a row was deleted, false if it didn't exist / wasn't this user's. */
export async function deleteExamPrediction(userId: string, id: string): Promise<boolean> {
  const table = await untypedTable("exam_predictions");
  const { data, error } = await table.delete().eq("id", id).eq("user_id", userId).select("id");

  if (error) throw new Error(`Couldn't delete that prediction: ${error.message}`);
  return (data ?? []).length > 0;
}
