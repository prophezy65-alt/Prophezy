import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { listMyHistory } from "@/lib/quiz/services/quiz.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quiz/history — every attempt this user has made, newest first.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const attempts = await listMyHistory(user.id);
    return ok({ attempts });
  } catch (error) {
    return fail(error);
  }
}
