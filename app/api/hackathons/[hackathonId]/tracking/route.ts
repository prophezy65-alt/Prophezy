import { z } from "zod";
import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["saved", "registered", "in_progress", "submitted", "completed", "withdrawn"]).optional(),
  preparationProgressPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * PATCH /api/hackathons/:hackathonId/tracking — updates status (e.g. move
 * from "saved" to "registered" after clicking the registration link) and/
 * or preparation progress. At least one of status/preparationProgressPercent required.
 */
export async function PATCH(request: Request, context: { params: Promise<{ hackathonId: string }> }) {
  try {
    const user = await requireApiUser();
    const { hackathonId } = await context.params;
    const decodedId = decodeURIComponent(hackathonId);
    const body = patchSchema.parse(await request.json());

    if (body.status === undefined && body.preparationProgressPercent === undefined) {
      throw new Error("Provide status and/or preparationProgressPercent.");
    }

    const { trackingService } = await buildHackathonModule();

    if (body.status !== undefined) {
      const result = await trackingService.setStatus(user.id, decodedId, body.status, body.notes);
      if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Failed to update tracking status.");
      if (body.preparationProgressPercent === undefined) return ok(result.data);
    }

    if (body.preparationProgressPercent !== undefined) {
      const result = await trackingService.updatePreparationProgress(user.id, decodedId, body.preparationProgressPercent);
      if (!result.ok || !result.data) throw new Error(result.error?.message ?? "Failed to update progress.");
      return ok(result.data);
    }

    // Unreachable given the guard above, but keeps every path returning.
    throw new Error("No update applied.");
  } catch (error) {
    return fail(error);
  }
}
