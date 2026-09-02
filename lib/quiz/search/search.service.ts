/**
 * lib/quiz/search/search.service.ts
 *
 * Four search modes over a user's question bank:
 *   - semantic: pgvector cosine similarity against quiz_questions.embedding
 *   - keyword:  Postgres full-text (websearch_to_tsquery) over question_text
 *   - topic:    exact topic_id filter
 *   - concept:  overlap against concept_tags
 *
 * Embeds via the existing AI Core client's embed() — reuses the same
 * embedding pipeline document_chunks (0006) already uses, not a new one.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { embed } from "../../ai/config/client";
import type { QuizQuestion } from "../models/quiz.types";

export interface SearchResult {
  question: QuizQuestion;
  score?: number; // present for semantic search (cosine similarity)
}

/** Call once per question right after generation to make it semantically searchable. */
export async function embedQuestion(questionId: string, questionText: string): Promise<void> {
  const supabase = await createServerClient();
  const vector = await embed(questionText);
  const { error } = await supabase.from("quiz_questions").update({ embedding: JSON.stringify(vector) }).eq("id", questionId);
  if (error) throw error;
}

export async function semanticSearch(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
  const supabase = await createServerClient();
  const vector = await embed(query);

  // match_quiz_questions is a Postgres function (create alongside this
  // migration set, or inline via rpc if the project prefers raw SQL functions
  // like the other pgvector search paths in the codebase) that joins
  // quiz_questions -> quizzes -> generations to scope by user_id and orders
  // by embedding <=> $1.
  const { data, error } = await supabase.rpc("match_quiz_questions", {
    query_embedding: JSON.stringify(vector),
    match_user_id: userId,
    match_count: limit,
  });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({ question: mapQuestionRow(row), score: row.similarity }));
}

export async function keywordSearch(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*, quizzes!inner(generation_id, generations!inner(user_id))")
    .textSearch("question_text", query, { type: "websearch" })
    .eq("quizzes.generations.user_id", userId)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ question: mapQuestionRow(row) }));
}

export async function topicSearch(userId: string, topicId: string, limit = 50): Promise<SearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*, quizzes!inner(generation_id, generations!inner(user_id))")
    .eq("topic_id", topicId)
    .eq("quizzes.generations.user_id", userId)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ question: mapQuestionRow(row) }));
}

export async function conceptSearch(userId: string, concepts: string[], limit = 50): Promise<SearchResult[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*, quizzes!inner(generation_id, generations!inner(user_id))")
    .overlaps("concept_tags", concepts)
    .eq("quizzes.generations.user_id", userId)
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ question: mapQuestionRow(row) }));
}

function mapQuestionRow(row: any): QuizQuestion {
  return {
    id: row.id,
    quizId: row.quiz_id,
    position: row.position,
    questionText: row.question_text,
    questionType: row.question_type,
    gradingMethod: row.grading_method,
    difficulty: row.difficulty,
    marks: row.marks,
    options: row.options,
    correctOption: row.correct_option,
    hint: row.hint,
    explanation: row.explanation,
    stepSolution: row.step_solution,
    topicId: row.topic_id,
    conceptTags: row.concept_tags ?? [],
    metadata: row.metadata ?? { kind: "generic" },
    createdAt: row.created_at,
  };
}
