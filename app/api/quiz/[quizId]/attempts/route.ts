import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { startAttempt } from "@/lib/quiz/services/quiz.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/quiz/:quizId/attempts — start a timed/untimed attempt. One call per "Start quiz" click.
export async function POST(_request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const { quizId } = await params;
    const attempt = await startAttempt({ quizId, userId: user.id });
    return ok({ attempt }, 201);
  } catch (error) {
    return fail(error);
  }
}
