/**
 * app/api/hackathons/route.ts
 *
 * GET /api/hackathons?country=&mode=&experienceTier=&eligibility=&minPrizePoolUsd=
 *   &technologies=&themes=&registrationDeadlineBefore=&submissionDeadlineBefore=
 *   &includePast=&sort=&cursor=&limit=
 *
 * Real hackathon listing endpoint — reads from public.hackathons via
 * HackathonService#list (repo -> Supabase, RLS-gated to the signed-in
 * user, same as every other route in this module). Filter/sort/pagination
 * parsing is shared with GET /api/hackathons/search via
 * lib/hackathons/http/parse.ts, so query syntax stays identical across
 * both endpoints.
 *
 * FIX (see audit): this file previously contained a byte-for-byte copy of
 * app/api/hackathons/notifications/route.ts (called
 * notificationService.listPending() instead of hackathonService.list()).
 * That meant every request to the page's actual data source silently
 * returned pending-notification data instead of hackathons, even though
 * the sync engine was writing real rows to public.hackathons correctly.
 * No fallback/mock data is introduced here — an empty listAll() result
 * still renders as a genuine empty state.
 */

import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";
import { parseFilters, parseSort, parseLimit } from "@/lib/hackathons/http/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/hackathons — paginated, filtered list of real synced hackathons. */
export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);

    const filters = parseFilters(url.searchParams);
    const sort = parseSort(url.searchParams);
    const limit = parseLimit(url.searchParams, 20, 100);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const includePast = url.searchParams.get("includePast") === "true";

    const { hackathonService } = await buildHackathonModule();
    const result = await hackathonService.list(filters, cursor, limit, includePast, sort);

    if (!result.ok) throw new Error(result.error?.message ?? "Failed to list hackathons.");
    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
