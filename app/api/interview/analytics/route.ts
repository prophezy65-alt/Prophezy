import { requireAuth, ok, fail } from "@/lib/interview/http";
import { computeAnalyticsSnapshot } from "@/lib/interview/analytics/analytics.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/interview/analytics
 * Recomputes and returns the caller's cross-session performance snapshot
 * (average score, per-topic and per-skill scores, strong/weak areas).
 */
export async function GET() {
  try {
    const { supabase, user } = await requireAuth();
    const snapshot = await computeAnalyticsSnapshot(supabase, user.id);
    return ok(snapshot);
  } catch (error) {
    return fail(error);
  }
}
