import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { getAnalyticsSnapshot } from "@/lib/quiz/analytics/analytics.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quiz/analytics — attempt summary, streak, and per-topic mastery.
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const snapshot = await getAnalyticsSnapshot(user.id);
    return ok({ snapshot });
  } catch (error) {
    return fail(error);
  }
}
