import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listPapers, savePaperFromSearchResult } from "@/lib/research/services/paper.service";
import { isResearchError } from "@/lib/research/utils/errors";
import type { Paper } from "@/lib/research/models/paper.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/research/papers?limit=&offset=&q= — the signed-in user's
 *  paper library, newest first.
 *
 * BUG FIX: this previously read a `search` query param, but
 * components/research/researchApi.ts's listPapers() — called by
 * useResearchQueries.ts's usePapers() — has always sent `q`
 * (`api.listPapers({ q: search || undefined })`). The Library tab's
 * "Filter your library by title..." box was therefore silently a no-op:
 * every keystroke re-ran the query with a param the server never looked
 * at, so it always returned the unfiltered list. Renamed to match what the
 * client actually sends. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const search = url.searchParams.get("q") ?? undefined;

  try {
    const papers = await listPapers(user.id, {
      limit: limitParam ? Number(limitParam) : undefined,
      offset: offsetParam ? Number(offsetParam) : undefined,
      search,
    });
    return NextResponse.json({ papers });
  } catch (error) {
    if (isResearchError(error)) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to list research papers." }, { status: 500 });
  }
}

/**
 * POST /api/research/papers — body: { paper: Paper }
 *
 * ============================================================================
 * ROOT CAUSE FIX — this handler did not exist before this change.
 * ============================================================================
 * This file only exported a GET. components/research/researchApi.ts's
 * savePaperFromSearch() has always done
 * `fetch("/api/research/papers", { method: "POST", ... })` for the "Save"
 * button on every Search Papers result card — with no POST export, that
 * request 405'd every single time, so no paper found via external search
 * could ever be added to the library (the toast just read "Failed to save
 * paper."). This was completely silent in the UI screenshots because the
 * duplicated-looking library cards came from re-uploading the same PDF, not
 * from this path — Save-from-search was simply dead on arrival.
 *
 * Body validation is intentionally loose on shape (it re-serializes the
 * `Paper` object the client already received from GET /api/research/search)
 * but strict on the fields savePaperFromSearchResult()'s dedup key depends
 * on (source, sourceId) — see paper.service.ts for the matching dedup fix,
 * which is what stops a second "Save" click (or a retried request) from
 * creating a duplicate library row.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { paper?: Paper };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paper = body.paper;
  if (!paper || typeof paper.title !== "string" || !paper.title.trim() || !paper.source || !paper.sourceId) {
    return NextResponse.json(
      { error: "`paper` must be a full search-result record with at least title, source, and sourceId." },
      { status: 400 }
    );
  }

  try {
    const saved = await savePaperFromSearchResult(user.id, paper);
    return NextResponse.json({ paper: saved }, { status: 201 });
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ error: "Failed to save paper." }, { status: 500 });
  }
}
