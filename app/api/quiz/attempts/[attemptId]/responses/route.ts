import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError, ForbiddenQuizError, NotFoundQuizError } from "@/lib/quiz/http/response";
import * as provider from "@/lib/quiz/providers/supabase-quiz.provider";
import { submitResponse } from "@/lib/quiz/grading/grading.service";
import { submitResponseSchema } from "@/lib/quiz/validation/quiz-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/quiz/attempts/:attemptId/responses — grade + persist one answer.
// Called as the user answers each question, not just at final submit, so
// exact/set-match feedback can be shown instantly.
export async function POST(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const { attemptId } = await params;
    const body = await request.json();
    const input = submitResponseSchema.parse({ ...body, attemptId });

    const { attempt } = await provider.getAttemptWithResponses(attemptId);
    if (attempt.userId !== user.id) throw new ForbiddenQuizError("You don't have access to this attempt.");

    const { questions } = await provider.getQuizWithQuestions(attempt.quizId);
    const question = questions.find((q) => q.id === input.questionId);
    if (!question) throw new NotFoundQuizError("Question not found on this quiz.");

    const response = await submitResponse(input, question);

    // Only reveal correctness for instantly-gradable types — ai_graded
    // responses are scored async-safe (still same call, but the feedback
    // is meaningful immediately either way since submitResponse awaits it).
    return ok({ response });
  } catch (error) {
    return fail(error);
  }
}
