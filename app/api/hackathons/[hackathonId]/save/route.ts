import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";
import { NotFoundError } from "@/lib/hackathons/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/hackathons/:hackathonId/save — bookmark a hackathon
 * (tracking status = 'saved'). Also scans and creates any due deadline
 * reminders for it, so saving is the moment reminders start existing for
 * that hackathon+user — matches notification.service.ts's own design
 * (reminders are scanned per tracked hackathon, not globally).
 */
export async function POST(_request: Request, context: { params: Promise<{ hackathonId: string }> }) {
  try {
    const user = await requireApiUser();
    const { hackathonId } = await context.params;
    const decodedId = decodeURIComponent(hackathonId);

    const { hackathonService, trackingService, notificationService } = await buildHackathonModule();

    const hackathonResult = await hackathonService.getById(decodedId);
    if (!hackathonResult.ok || !hackathonResult.data) throw new NotFoundError("Hackathon not found.");

    const trackingResult = await trackingService.setStatus(user.id, decodedId, "saved");
    if (!trackingResult.ok || !trackingResult.data) throw new Error(trackingResult.error?.message ?? "Failed to save hackathon.");

    // Best-effort — a reminder-scan failure shouldn't fail the save itself.
    try {
      await notificationService.scanDeadlineReminders(user.id, hackathonResult.data);
    } catch {
      // swallowed intentionally — see comment above
    }

    return ok(trackingResult.data, 201);
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/hackathons/:hackathonId/save — unsave (removes the tracking entry entirely). */
export async function DELETE(_request: Request, context: { params: Promise<{ hackathonId: string }> }) {
  try {
    const user = await requireApiUser();
    const { hackathonId } = await context.params;

    const { trackingService } = await buildHackathonModule();
    await trackingService.remove(user.id, decodeURIComponent(hackathonId));

    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
