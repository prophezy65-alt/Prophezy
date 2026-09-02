import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError, ForbiddenQuizError } from "@/lib/quiz/http/response";
import * as provider from "@/lib/quiz/providers/supabase-quiz.provider";
import { submitAttemptAndAnalyze } from "@/lib/quiz/services/quiz.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/quiz/attempts/:attemptId/submit — finalize: grade, score, update
// topic mastery, leaderboard, and streak. Returns the full result in one call.
export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const { attemptId } = await params;
    const { attempt: existing } = await provider.getAttemptWithResponses(attemptId);
    if (existing.userId !== user.id) throw new ForbiddenQuizError("You don't have access to this attempt.");

    const result = await submitAttemptAndAnalyze({ attemptId, userId: user.id });
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
}
