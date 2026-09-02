import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPapers } from "@/lib/research/services/paper-search.service";
import { isResearchError } from "@/lib/research/utils/errors";
import type { SearchKind } from "@/lib/research/models/paper.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/research/search?q=&kind=keyword — search external paper sources. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const kind = (searchParams.get("kind") ?? "keyword") as SearchKind;
  const limitParam = searchParams.get("limit");

  if (!query?.trim()) {
    return NextResponse.json({ error: "Query parameter `q` is required." }, { status: 400 });
  }

  try {
    const result = await searchPapers({
      query: query.trim(),
      kind,
      limit: limitParam ? Number(limitParam) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
