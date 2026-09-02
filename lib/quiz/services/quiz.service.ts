/**
 * lib/quiz/services/quiz.service.ts
 *
 * The orchestration layer API routes call directly. Composes the other
 * services (grading, analytics, leaderboard, adaptive) into the three
 * user-facing flows: start an attempt, submit an attempt, request a
 * follow-up quiz. Question generation itself lives in generator.service.ts;
 * this file is what happens after a quiz already exists.
 */

import { startAttemptSchema, type StartAttemptInput } from "../validation/quiz-schemas";
import * as provider from "../providers/supabase-quiz.provider";
import * as gradingService from "../grading/grading.service";
import * as analyticsService from "../analytics/analytics.service";
import * as leaderboardService from "./leaderboard.service";
import { generateFollowupQuiz, persistGeneratedQuiz } from "../generator/generator.service";
import type { Quiz, QuizAttempt, QuizQuestion, QuizResult } from "../models/quiz.types";
import { submitAttemptSchema, type SubmitAttemptInput } from "../validation/quiz-schemas";
import { ForbiddenQuizError } from "../http/response";

export async function getQuiz(quizId: string): Promise<{ quiz: Quiz; questions: QuizQuestion[] }> {
  return provider.getQuizWithQuestions(quizId);
}

export async function startAttempt(input: StartAttemptInput): Promise<QuizAttempt> {
  const parsed = startAttemptSchema.parse(input);
  const { quiz, questions } = await provider.getQuizWithQuestions(parsed.quizId);
  const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
  return provider.insertAttempt(quiz.id, parsed.userId, maxScore, quiz.isAdaptive);
}

/**
 * Full submit flow: grade, roll up score, run analytics, update mastery,
 * update leaderboard/streak. Returns the complete result the results page
 * needs in one call.
 */
export async function submitAttemptAndAnalyze(input: SubmitAttemptInput): Promise<QuizResult> {
  const parsed = submitAttemptSchema.parse(input);
  const { attempt: existingAttempt } = await provider.getAttemptWithResponses(parsed.attemptId);
  const { quiz, questions } = await provider.getQuizWithQuestions(existingAttempt.quizId);

  const { attempt, responses } = await gradingService.submitAttempt(parsed, {
    questions,
    timeLimitSec: quiz.timeLimitSec,
    negativeMarking: quiz.negativeMarking,
  });

  const result = await analyticsService.buildQuizResult(attempt, responses, questions);
  await analyticsService.updateTopicMastery(parsed.userId, result.topicBreakdown);

  const topics = await provider.getTopicsByIds(quiz.topicIds);
  const subject = topics[0]?.subject ?? null;
  await leaderboardService.recordAttemptOnLeaderboard(attempt, parsed.userId, quiz.difficulty, subject);
  await leaderboardService.recordDailyActivity(parsed.userId);

  return result;
}

/** Every quiz this user has generated, with best score + attempt count — for the quiz library page. */
export async function listMyQuizzes(userId: string) {
  return provider.listQuizzesByUser(userId);
}

/** Every attempt this user has made, newest first — for the history page. */
export async function listMyHistory(userId: string) {
  return provider.listAttemptsByUser(userId);
}

/** A single attempt's full result (for the results page, or re-opening a past attempt). Verifies ownership. */
export async function getAttemptResult(attemptId: string, requestingUserId: string): Promise<QuizResult> {
  const { attempt, responses } = await provider.getAttemptWithResponses(attemptId);
  if (attempt.userId !== requestingUserId) {
    throw new ForbiddenQuizError("You don't have access to this attempt.");
  }
  const { questions } = await provider.getQuizWithQuestions(attempt.quizId);
  return analyticsService.buildQuizResult(attempt, responses, questions);
}

/** Convenience wrapper: builds and persists a follow-up quiz straight from a just-graded result. */
export async function createFollowupQuizFromResult(params: {
  userId: string;
  generationId: string; // new generations row, created by the caller via the existing flow
  sourceContent: string;
  result: QuizResult;
  questions: QuizQuestion[];
  difficulty: Quiz["difficulty"];
  questionTypes: QuizQuestion["questionType"][];
  questionCount?: number;
}) {
  const missedQuestionTexts = params.result.responses
    .filter((r) => r.isCorrect === false)
    .map((r) => params.questions.find((q) => q.id === r.questionId)?.questionText)
    .filter((t): t is string => !!t);

  const { title, validatedQuestions } = await generateFollowupQuiz({
    userId: params.userId,
    sourceContent: params.sourceContent,
    weakTopics: params.result.weakTopics.map((t) => t.topicName),
    missedQuestionTexts,
    difficulty: params.difficulty,
    questionTypes: params.questionTypes,
    questionCount: params.questionCount ?? 10,
  });

  return persistGeneratedQuiz({
    generationId: params.generationId,
    title,
    examMode: "revision_test",
    difficulty: params.difficulty,
    isAdaptive: false,
    timeLimitSec: null,
    negativeMarking: 0,
    topicIds: params.result.weakTopics.map((t) => t.topicId),
    sourceUploadId: null,
    validatedQuestions,
  });
}
