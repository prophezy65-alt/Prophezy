/**
 * lib/quiz/grading/grading.service.ts
 *
 * Two grading paths, chosen by question.gradingMethod:
 *   - exact_match / set_match -> scoring.ts, no AI call, instant
 *   - ai_graded -> grading.prompt.ts via runStructured, cached per
 *     (question, response) by the AI Core Engine's response cache
 *
 * Also owns attempt finalization: rolling all responses into a final score
 * with negative marking applied, and persisting it.
 */

import { runStructured } from "../../ai/services/_run-structured";
import { GRADING_PROMPT } from "../prompts/grading.prompt";
import { gradeLocally, rollupScore } from "../utils/scoring";
import { checkTimeWindow } from "../utils/timer";
import { submitResponseSchema, submitAttemptSchema, type SubmitResponseInput, type SubmitAttemptInput } from "../validation/quiz-schemas";
import type { QuizQuestion, QuizResponse, QuizAttempt } from "../models/quiz.types";
import * as provider from "../providers/supabase-quiz.provider";

/**
 * Grades and persists a single response. Called as the user answers each
 * question (live-save UX), not just at final submit — so exact/set-match
 * feedback can be instant if the quiz mode allows immediate feedback.
 */
export async function submitResponse(input: SubmitResponseInput, question: QuizQuestion): Promise<QuizResponse> {
  const parsed = submitResponseSchema.parse(input);

  if (question.gradingMethod === "ai_graded") {
    const responseText = typeof parsed.response === "string" ? parsed.response : JSON.stringify(parsed.response);
    const meta = question.metadata as any;

    const graded = await runStructured(GRADING_PROMPT, {
      userId: "system", // grading runs server-side on behalf of the attempt owner, not as a user-attributed generation
      input: {
        questionType: question.questionType,
        questionText: question.questionText,
        modelSolution: meta?.modelSolution ?? question.explanation ?? "",
        rubric: meta?.rubric ?? [],
        maxMarks: question.marks,
        studentResponse: responseText,
      },
    });

    return provider.upsertResponse({
      attemptId: parsed.attemptId,
      questionId: parsed.questionId,
      response: parsed.response,
      isCorrect: graded.isCorrect,
      marksAwarded: graded.marksAwarded,
      aiFeedback: graded.feedback,
      timeSpentSec: parsed.timeSpentSec ?? null,
      hintUsed: parsed.hintUsed,
    });
  }

  const { isCorrect, marksAwarded } = gradeLocally(question, parsed.response);

  return provider.upsertResponse({
    attemptId: parsed.attemptId,
    questionId: parsed.questionId,
    response: parsed.response,
    isCorrect,
    marksAwarded,
    aiFeedback: null,
    timeSpentSec: parsed.timeSpentSec ?? null,
    hintUsed: parsed.hintUsed,
  });
}

export interface SubmitAttemptResult {
  attempt: QuizAttempt;
  responses: QuizResponse[];
}

/**
 * Finalizes an attempt: ensures every question has a graded response (grades
 * any that were skipped during live-save), rolls up the final score with
 * negative marking, and persists the attempt as 'graded'.
 */
export async function submitAttempt(
  input: SubmitAttemptInput,
  quizContext: { questions: QuizQuestion[]; timeLimitSec: number | null; negativeMarking: number }
): Promise<SubmitAttemptResult> {
  const parsed = submitAttemptSchema.parse(input);
  const { attempt, responses } = await provider.getAttemptWithResponses(parsed.attemptId);

  const questionById = new Map(quizContext.questions.map((q) => [q.id, q]));
  const responseByQuestionId = new Map(responses.map((r) => [r.questionId, r]));

  // Grade any question that was never touched by submitResponse (e.g. user
  // navigated away without answering) as an ungraded, zero-mark skip.
  const finalResponses: QuizResponse[] = [];
  for (const question of quizContext.questions) {
    const existing = responseByQuestionId.get(question.id);
    if (existing) {
      finalResponses.push(existing);
      continue;
    }
    const skipped = await provider.upsertResponse({
      attemptId: parsed.attemptId,
      questionId: question.id,
      response: null,
      isCorrect: null,
      marksAwarded: null,
      aiFeedback: null,
      timeSpentSec: null,
      hintUsed: false,
    });
    finalResponses.push(skipped);
  }

  const rollup = rollupScore({
    responses: finalResponses.map((r) => ({
      marksAwarded: r.marksAwarded,
      isCorrect: r.isCorrect,
      maxMarks: questionById.get(r.questionId)?.marks ?? 0,
    })),
    negativeMarking: quizContext.negativeMarking,
  });

  const submittedAt = new Date().toISOString();
  const { elapsedSec } = checkTimeWindow(attempt.startedAt, submittedAt, quizContext.timeLimitSec);

  const finalizedAttempt = await provider.finalizeAttempt(parsed.attemptId, {
    rawScore: rollup.rawScore,
    finalScore: rollup.finalScore,
    accuracyPct: rollup.accuracyPct,
    completionPct: rollup.completionPct,
    timeTakenSec: elapsedSec,
    status: "graded",
  });

  return { attempt: finalizedAttempt, responses: finalResponses };
}
