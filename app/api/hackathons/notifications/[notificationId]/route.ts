import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/hackathons/notifications/:notificationId — marks a reminder
 * as sent/dismissed. No body needed (this is the only mutation the real
 * NotificationRepository interface exposes for a single notification).
 *
 * NOTE: markSent() doesn't check ownership itself (NotificationRepository
 * has no such check by design — see that file). RLS on
 * hackathon_notifications (0037_hackathon_engine.sql) is the actual
 * enforcement: `auth.uid() = user_id` on the underlying update, so a user
 * genuinely cannot mark another user's notification sent even with a
 * guessed id — Postgres will just match zero rows.
 */
export async function PATCH(_request: Request, context: { params: Promise<{ notificationId: string }> }) {
  try {
    await requireApiUser();
    const { notificationId } = await context.params;

    const { notificationService } = await buildHackathonModule();
    const result = await notificationService.markSent(notificationId);
    if (!result.ok) throw new Error(result.error?.message ?? "Failed to update notification.");

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
