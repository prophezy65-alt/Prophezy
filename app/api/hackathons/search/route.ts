import { buildHackathonModule } from "@/lib/hackathons/providers/module-composition";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { ok, fail } from "@/lib/hackathons/http/response";
import { parseFilters, parseLimit } from "@/lib/hackathons/http/parse";
import type { SearchDomain } from "@/lib/hackathons/models/hackathon.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DOMAINS: SearchDomain[] = ["hackathon", "technology", "theme", "organizer", "company"];

/** GET /api/hackathons/search?q=...&domain=hackathon&...filters&limit= */
export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const domainParam = url.searchParams.get("domain") ?? "hackathon";
    const domain = (VALID_DOMAINS as string[]).includes(domainParam) ? (domainParam as SearchDomain) : "hackathon";

    const { searchService } = await buildHackathonModule();
    const result = await searchService.search({
      domain,
      query: url.searchParams.get("q") ?? "",
      filters: parseFilters(url.searchParams),
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: parseLimit(url.searchParams, 10, 50),
    });

    if (!result.ok) throw new Error(result.error?.message ?? "Search failed.");
    return ok(result.data);
  } catch (error) {
    return fail(error);
  }
}
