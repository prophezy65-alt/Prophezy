import { analyticsService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/analytics — cross-deck analytics for the current user. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const analytics = await analyticsService.getUserAnalytics(user.id);
    return ok(analytics);
  } catch (error) {
    return fail(error);
  }
}
