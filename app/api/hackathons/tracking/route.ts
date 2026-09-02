import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";
import type { TrackingStatus } from "@/lib/hackathons/models/hackathon.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: TrackingStatus[] = ["saved", "registered", "in_progress", "submitted", "completed", "withdrawn"];

/**
 * GET /api/hackathons/tracking?status=saved — the user's tracked
 * hackathons, optionally filtered by status. Powers both a "Saved/
 * Bookmarks" view (status=saved) and a general "My Hackathons" view (no
 * status filter). Joins in the full Hackathon record for each entry so the
 * frontend doesn't need a second round-trip per card.
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && (VALID_STATUSES as string[]).includes(statusParam) ? (statusParam as TrackingStatus) : undefined;

    const { trackingService, hackathonService } = await buildHackathonModule();

    const entriesResult = await trackingService.listByStatus(user.id, status);
    if (!entriesResult.ok || !entriesResult.data) throw new Error(entriesResult.error?.message ?? "Failed to list tracked hackathons.");

    const withHackathons = await Promise.all(
      entriesResult.data.map(async (entry) => {
        const hackathonResult = await hackathonService.getById(entry.hackathonId);
        return { entry, hackathon: hackathonResult.ok ? hackathonResult.data ?? null : null };
      })
    );

    // A hackathon can have been deleted (deduped/expired) after being tracked — drop those rather than showing a broken card.
    return ok(withHackathons.filter((row) => row.hackathon !== null));
  } catch (error) {
    return fail(error);
  }
}
