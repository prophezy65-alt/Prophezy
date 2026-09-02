/**
 * lib/quiz/providers/supabase-quiz.provider.ts
 *
 * All raw Supabase reads/writes for the quiz engine live here — services
 * call these functions instead of touching the client directly, so the
 * query shape is defined once per table.
 *
 * ASSUMPTION (only unverified piece in this codebase): the project exposes
 * a server-side Supabase client factory at `@/lib/supabase/server` as
 * `createServerClient()`, matching the standard Next.js App Router +
 * Supabase SSR pattern. If your actual path/export differs, this is the
 * only file that needs to change — every service below goes through it.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Json, Database } from "@/lib/supabase/types";
import type {
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizResponse,
  QuizTopic,
  LeaderboardEntry,
} from "../models/quiz.types";

async function db() {
  return createServerClient();
}

// ---- quizzes / questions --------------------------------------------

export async function insertQuiz(row: {
  generationId: string;
  title: string;
  examMode: string;
  difficulty: string;
  isAdaptive: boolean;
  timeLimitSec: number | null;
  negativeMarking: number;
  topicIds: string[];
  sourceUploadId: string | null;
  questionCount: number;
}): Promise<Quiz> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quizzes")
    .insert({
      generation_id: row.generationId,
      title: row.title,
      exam_mode: row.examMode as Database["public"]["Enums"]["quiz_exam_mode"],
      difficulty: row.difficulty as Database["public"]["Enums"]["quiz_difficulty"],
      is_adaptive: row.isAdaptive,
      time_limit_sec: row.timeLimitSec,
      negative_marking: row.negativeMarking,
      topic_ids: row.topicIds,
      source_upload_id: row.sourceUploadId,
      question_count: row.questionCount,
    })
    .select()
    .single();

  if (error) throw error;
  return mapQuizRow(data);
}

export async function insertQuestions(quizId: string, questions: Array<Record<string, unknown>>): Promise<QuizQuestion[]> {
  const supabase = await db();
  const rows = questions.map((q, index) => ({
    quiz_id: quizId,
    position: index,
    question_text: q.questionText,
    question_type: q.questionType,
    grading_method: q.gradingMethod,
    difficulty: q.difficulty,
    marks: q.marks,
    options: q.options ?? null,
    correct_option: q.correctOption ?? null,
    hint: q.hint ?? null,
    explanation: q.explanation ?? null,
    step_solution: q.stepSolution ?? null,
    topic_id: q.topicId ?? null,
    concept_tags: q.conceptTags ?? [],
    metadata: q.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from("quiz_questions")
    .insert(rows as Database["public"]["Tables"]["quiz_questions"]["Insert"][])
    .select();
  if (error) throw error;
  return (data ?? []).map(mapQuestionRow);
}

export async function getQuizWithQuestions(quizId: string): Promise<{ quiz: Quiz; questions: QuizQuestion[] }> {
  const supabase = await db();
  const [{ data: quizRow, error: quizErr }, { data: questionRows, error: qErr }] = await Promise.all([
    supabase.from("quizzes").select().eq("id", quizId).single(),
    supabase.from("quiz_questions").select().eq("quiz_id", quizId).order("position"),
  ]);
  if (quizErr) throw quizErr;
  if (qErr) throw qErr;
  return { quiz: mapQuizRow(quizRow), questions: (questionRows ?? []).map(mapQuestionRow) };
}

// ---- attempts / responses --------------------------------------------

export async function insertAttempt(quizId: string, userId: string, maxScore: number, isAdaptiveRun: boolean): Promise<QuizAttempt> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({ quiz_id: quizId, user_id: userId, max_score: maxScore, is_adaptive_run: isAdaptiveRun })
    .select()
    .single();
  if (error) throw error;
  return mapAttemptRow(data);
}

export async function upsertResponse(row: {
  attemptId: string;
  questionId: string;
  response: unknown;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  aiFeedback: string | null;
  timeSpentSec: number | null;
  hintUsed: boolean;
}): Promise<QuizResponse> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_responses")
    .upsert(
      {
        attempt_id: row.attemptId,
        question_id: row.questionId,
        response: row.response as unknown as Json,
        is_correct: row.isCorrect,
        marks_awarded: row.marksAwarded,
        ai_feedback: row.aiFeedback,
        time_spent_sec: row.timeSpentSec,
        hint_used: row.hintUsed,
      },
      { onConflict: "attempt_id,question_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return mapResponseRow(data);
}

export async function getAttemptWithResponses(attemptId: string): Promise<{ attempt: QuizAttempt; responses: QuizResponse[] }> {
  const supabase = await db();
  const [{ data: attemptRow, error: aErr }, { data: responseRows, error: rErr }] = await Promise.all([
    supabase.from("quiz_attempts").select().eq("id", attemptId).single(),
    supabase.from("quiz_responses").select().eq("attempt_id", attemptId),
  ]);
  if (aErr) throw aErr;
  if (rErr) throw rErr;
  return { attempt: mapAttemptRow(attemptRow), responses: (responseRows ?? []).map(mapResponseRow) };
}

export async function finalizeAttempt(
  attemptId: string,
  fields: { rawScore: number; finalScore: number; accuracyPct: number; completionPct: number; timeTakenSec: number; status: "graded" }
): Promise<QuizAttempt> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .update({
      raw_score: fields.rawScore,
      final_score: fields.finalScore,
      accuracy_pct: fields.accuracyPct,
      completion_pct: fields.completionPct,
      time_taken_sec: fields.timeTakenSec,
      status: fields.status,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .select()
    .single();
  if (error) throw error;
  return mapAttemptRow(data);
}

// ---- source content resolution (reuses existing document_chunks / notes) --

/** Concatenates a document's chunks in order — reuses the existing RAG pipeline's storage, not a new one. */
export async function getUploadChunksText(uploadId: string): Promise<string> {
  const supabase = await db();
  // NOTE: the document-intelligence migration renamed document_chunks columns
  // (upload_id -> document_id, content -> text). This treats the passed id as a
  // documents.id. FLAG: confirm the quiz "uploadId" is a documents.id and not a
  // legacy uploads.id — the documents table has no upload_id to join through.
  const { data, error } = await supabase
    .from("document_chunks")
    .select("text")
    .eq("document_id", uploadId)
    .order("chunk_index");
  if (error) throw error;
  return (data ?? []).map((r) => r.text).join("\n\n");
}

/** Pulls markdown content from an existing generation (notes, syllabus, etc.) to quiz off of. */
export async function getGenerationContent(generationId: string): Promise<string> {
  const supabase = await db();
  const { data: notes } = await supabase.from("notes").select("content_md").eq("generation_id", generationId).maybeSingle();
  if (notes?.content_md) return notes.content_md;

  // Fall back to assignment instructions if the generation is an assignment, not notes-shaped.
  const { data: assignment } = await supabase
    .from("assignments")
    .select("instructions")
    .eq("generation_id", generationId)
    .maybeSingle();
  if (assignment?.instructions) return assignment.instructions;

  throw new Error(`No quizzable content found for generation ${generationId}.`);
}

// ---- topics -------------------------------------------------------------


export async function getTopicsByIds(topicIds: string[]): Promise<QuizTopic[]> {
  if (topicIds.length === 0) return [];
  const supabase = await db();
  const { data, error } = await supabase.from("quiz_topics").select().in("id", topicIds);
  if (error) throw error;
  return (data ?? []).map(mapTopicRow);
}

export interface TopicMasteryRow {
  masteryScore: number;
  attemptsCount: number;
  correctCount: number;
}

/** Reads the current mastery row for a topic, or null if the user has never attempted it. Read-before-write for a true rolling EMA. */
export async function getTopicMastery(userId: string, topicId: string): Promise<TopicMasteryRow | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_topic_mastery")
    .select("mastery_score, attempts_count, correct_count")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { masteryScore: Number(data.mastery_score), attemptsCount: data.attempts_count, correctCount: data.correct_count };
}

export async function upsertTopicMastery(
  userId: string,
  topicId: string,
  previousScore: number,
  previousAttempts: number,
  newScore: number,
  correctIncrement = 0
): Promise<void> {
  const supabase = await db();
  const { data: existing } = await supabase
    .from("quiz_topic_mastery")
    .select("correct_count")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const { error } = await supabase.from("quiz_topic_mastery").upsert(
    {
      user_id: userId,
      topic_id: topicId,
      mastery_score: newScore,
      attempts_count: previousAttempts + 1,
      correct_count: (existing?.correct_count ?? 0) + correctIncrement,
      last_attempt_at: new Date().toISOString(),
    },
    { onConflict: "user_id,topic_id" }
  );
  if (error) throw error;
}

/** All topic-mastery rows for a user, joined with topic name/subject — for the analytics page. */
export async function listTopicMasteryForUser(userId: string): Promise<Array<{ topicId: string; topicName: string; subject: string | null; masteryScore: number; attemptsCount: number; correctCount: number }>> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_topic_mastery")
    .select("topic_id, mastery_score, attempts_count, correct_count, quiz_topics(name, subject)")
    .eq("user_id", userId)
    .order("mastery_score", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    topicId: row.topic_id,
    topicName: row.quiz_topics?.name ?? "Untitled topic",
    subject: row.quiz_topics?.subject ?? null,
    masteryScore: Number(row.mastery_score),
    attemptsCount: row.attempts_count,
    correctCount: row.correct_count,
  }));
}

// ---- leaderboard --------------------------------------------------------

export async function upsertLeaderboardEntry(userId: string, scope: string, subject: string | null, scoreDelta: number): Promise<void> {
  const supabase = await db();
  const { data: existing } = await supabase
    .from("quiz_leaderboard_entries")
    .select("score, attempts_count")
    .eq("user_id", userId)
    .eq("scope", scope)
    .maybeSingle();

  const { error } = await supabase.from("quiz_leaderboard_entries").upsert(
    {
      user_id: userId,
      scope,
      subject,
      score: (existing?.score ?? 0) + scoreDelta,
      attempts_count: (existing?.attempts_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,scope" }
  );
  if (error) throw error;
}

export async function getLeaderboard(scope: string, limit = 50): Promise<LeaderboardEntry[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_leaderboard_entries")
    .select()
    .eq("scope", scope)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any, index: number) => ({
    userId: row.user_id,
    scope: row.scope,
    subject: row.subject,
    score: row.score,
    attemptsCount: row.attempts_count,
    rank: index + 1,
  }));
}

// ---- streaks --------------------------------------------------------------

export interface StreakRow {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

export async function getStreak(userId: string): Promise<StreakRow> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_streaks")
    .select("current_streak, longest_streak, last_activity_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
  return { currentStreak: data.current_streak, longestStreak: data.longest_streak, lastActivityDate: data.last_activity_date };
}

export async function upsertStreak(userId: string, streak: StreakRow): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("quiz_streaks").upsert(
    {
      user_id: userId,
      current_streak: streak.currentStreak,
      longest_streak: streak.longestStreak,
      last_activity_date: streak.lastActivityDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function insertBadgesIfNew(userId: string, badgeKeys: string[]): Promise<void> {
  if (badgeKeys.length === 0) return;
  const supabase = await db();
  const { error } = await supabase
    .from("quiz_badges")
    .upsert(
      badgeKeys.map((badgeKey) => ({ user_id: userId, badge_key: badgeKey })),
      { onConflict: "user_id,badge_key", ignoreDuplicates: true }
    );
  if (error) throw error;
}

// ---- quiz library / history -----------------------------------------------

export interface QuizLibraryRow extends Quiz {
  bestScorePct: number | null;
  attemptsCount: number;
}

/** Every quiz generated by this user (via their own generations rows), newest first. */
export async function listQuizzesByUser(userId: string, limit = 50): Promise<QuizLibraryRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quizzes")
    .select("*, generations!inner(user_id), quiz_attempts(final_score, max_score, status)")
    .eq("generations.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const graded = (row.quiz_attempts ?? []).filter((a: any) => a.status === "graded" && a.final_score !== null);
    const bestScorePct = graded.length
      ? Math.max(...graded.map((a: any) => (a.max_score > 0 ? (Number(a.final_score) / Number(a.max_score)) * 100 : 0)))
      : null;
    return { ...mapQuizRow(row), bestScorePct: bestScorePct !== null ? Math.round(bestScorePct * 100) / 100 : null, attemptsCount: (row.quiz_attempts ?? []).length };
  });
}

export interface AttemptHistoryRow extends QuizAttempt {
  quizTitle: string;
  quizDifficulty: string;
  quizExamMode: string;
  quizQuestionCount: number;
}

/** Every graded/in-progress attempt by this user, newest first, with the quiz title attached. */
export async function listAttemptsByUser(userId: string, limit = 50): Promise<AttemptHistoryRow[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*, quizzes(title, difficulty, exam_mode, question_count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...mapAttemptRow(row),
    quizTitle: row.quizzes?.title ?? "Untitled quiz",
    quizDifficulty: row.quizzes?.difficulty ?? "medium",
    quizExamMode: row.quizzes?.exam_mode ?? "practice",
    quizQuestionCount: row.quizzes?.question_count ?? 0,
  }));
}

// ---- row mappers (snake_case DB -> camelCase domain types) ---------------

function mapQuizRow(row: any): Quiz {
  return {
    id: row.id,
    generationId: row.generation_id,
    title: row.title,
    examMode: row.exam_mode,
    difficulty: row.difficulty,
    isAdaptive: row.is_adaptive,
    timeLimitSec: row.time_limit_sec,
    negativeMarking: Number(row.negative_marking),
    topicIds: row.topic_ids ?? [],
    sourceUploadId: row.source_upload_id,
    questionCount: row.question_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

function mapAttemptRow(row: any): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    userId: row.user_id,
    status: row.status,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    timeTakenSec: row.time_taken_sec,
    rawScore: row.raw_score !== null ? Number(row.raw_score) : null,
    finalScore: row.final_score !== null ? Number(row.final_score) : null,
    maxScore: Number(row.max_score),
    accuracyPct: row.accuracy_pct !== null ? Number(row.accuracy_pct) : null,
    completionPct: Number(row.completion_pct),
    isAdaptiveRun: row.is_adaptive_run,
    nextDifficulty: row.next_difficulty,
    createdAt: row.created_at,
  };
}

function mapResponseRow(row: any): QuizResponse {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    response: row.response,
    isCorrect: row.is_correct,
    marksAwarded: row.marks_awarded !== null ? Number(row.marks_awarded) : null,
    aiFeedback: row.ai_feedback,
    timeSpentSec: row.time_spent_sec,
    hintUsed: row.hint_used,
    answeredAt: row.answered_at,
  };
}

function mapTopicRow(row: any): QuizTopic {
  return {
    id: row.id,
    userId: row.user_id,
    parentId: row.parent_id,
    name: row.name,
    subject: row.subject,
    createdAt: row.created_at,
  };
}
