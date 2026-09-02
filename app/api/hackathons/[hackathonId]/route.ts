import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";
import { NotFoundError } from "@/lib/hackathons/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/hackathons/:hackathonId */
export async function GET(_request: Request, context: { params: Promise<{ hackathonId: string }> }) {
  try {
    await requireApiUser();
    const { hackathonId } = await context.params;

    const { hackathonService } = await buildHackathonModule();
    const result = await hackathonService.getById(decodeURIComponent(hackathonId));

    if (!result.ok || !result.data) throw new NotFoundError(result.error?.message ?? "Hackathon not found.");
    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
