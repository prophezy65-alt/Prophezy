import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError, NotFoundQuizError } from "@/lib/quiz/http/response";
import { getQuiz } from "@/lib/quiz/services/quiz.service";
import { sanitizeQuestionForAttempt } from "@/lib/quiz/utils/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quiz/:quizId — quiz + questions, sanitized for taking (no answers/explanations).
// RLS on `quizzes`/`quiz_questions` scopes this to the owning user already; a
// row that doesn't belong to the caller simply won't be found.
export async function GET(_request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const { quizId } = await params;
    const { quiz, questions } = await getQuiz(quizId).catch(() => {
      throw new NotFoundQuizError("Quiz not found.");
    });

    return ok({ quiz, questions: questions.map(sanitizeQuestionForAttempt) });
  } catch (error) {
    return fail(error);
  }
}
