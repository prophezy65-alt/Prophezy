/**
 * lib/quiz/services/review.service.ts
 *
 * "Mark for review" (revisit before submitting, standard exam-mode UX) and
 * "report this question" (flag a bad/ambiguous AI-generated question for
 * quality tracking). Both write to quiz_question_reviews (0025).
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { QuizQuestionReview } from "../models/quiz.types";

export async function markForReview(userId: string, questionId: string, marked: boolean): Promise<QuizQuestionReview> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quiz_question_reviews")
    .insert({ user_id: userId, question_id: questionId, marked_for_review: marked })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function reportQuestion(userId: string, questionId: string, issue: string): Promise<QuizQuestionReview> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quiz_question_reviews")
    .insert({ user_id: userId, question_id: questionId, marked_for_review: false, reported_issue: issue })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function getReviewedQuestionIds(userId: string, attemptQuestionIds: string[]): Promise<string[]> {
  if (attemptQuestionIds.length === 0) return [];
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quiz_question_reviews")
    .select("question_id")
    .eq("user_id", userId)
    .eq("marked_for_review", true)
    .in("question_id", attemptQuestionIds);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.question_id);
}

function mapRow(row: any): QuizQuestionReview {
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    markedForReview: row.marked_for_review,
    reportedIssue: row.reported_issue,
    createdAt: row.created_at,
  };
}
