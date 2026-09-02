import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { getAttemptResult, getQuiz } from "@/lib/quiz/services/quiz.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quiz/attempts/:attemptId — full result: score, per-question
// correctness/explanations, weak/strong topics, revision suggestions.
// getAttemptResult() itself throws a 403 if the attempt isn't the caller's.
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const { attemptId } = await params;
    const result = await getAttemptResult(attemptId, user.id);
    const { quiz, questions } = await getQuiz(result.attempt.quizId);

    return ok({ result, quiz, questions });
  } catch (error) {
    return fail(error);
  }
}
