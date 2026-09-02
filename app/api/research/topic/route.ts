import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchTopics } from "@/lib/research/services/topic-explorer.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/research/topic?topic=&limit=&offset=&topicFilter=
 *
 * ============================================================================
 * REPLACED — this used to be a POST that called Gemini (runResearch) to
 * write a prose "overview" of the topic, with no real papers involved and
 * no way to open a result, browse, or filter. That violated the product
 * requirement that discovery/search/topic exploration make ZERO Gemini
 * calls, and it was also what was burning through the Gemini key rotation
 * pool during ordinary browsing (see the "all 16 keys rate-limited" error
 * you hit — Topic Explorer was a real, avoidable source of that load).
 *
 * This is now a plain GET (it's read-only — no reason for it to be a POST)
 * that searches `research_synced_papers` deterministically via
 * lib/research/services/topic-explorer.service.ts. Zero Gemini. Zero
 * credit cost, matching "browsing costs 0 credits" — no spendCredits call
 * anywhere in this path.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get("topic");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const topicFilter = searchParams.get("topicFilter") ?? undefined;

  if (!topic?.trim()) {
    return NextResponse.json({ error: "`topic` query parameter is required." }, { status: 400 });
  }

  try {
    const result = await searchTopics({
      topic: topic.trim(),
      limit: limitParam ? Number(limitParam) : undefined,
      offset: offsetParam ? Number(offsetParam) : undefined,
      topicFilter,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "RESEARCH_VALIDATION_ERROR" ? 400 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Topic search failed." }, { status: 500 });
  }
}
