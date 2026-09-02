import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/hackathons/notifications — pending (unsent) reminders/alerts for the current user. */
export async function GET() {
  try {
    const user = await requireApiUser();
    const { notificationService } = await buildHackathonModule();

    const result = await notificationService.listPending(user.id);
    if (!result.ok) throw new Error(result.error?.message ?? "Failed to list notifications.");

    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
