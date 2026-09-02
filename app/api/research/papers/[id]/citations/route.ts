import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCitations, extractCitations } from "@/lib/research/services/citation.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/research/papers/[id]/citations — previously extracted citations. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const citations = await listCitations(user.id, id);
    return NextResponse.json({ citations });
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "PAPER_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Failed to load citations." }, { status: 500 });
  }
}

/** POST /api/research/papers/[id]/citations — (re)run extraction, replacing any previous result. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const citations = await extractCitations(user.id, id);
    return NextResponse.json({ citations });
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "PAPER_NOT_FOUND" ? 404 : error.code === "CITATION_EXTRACTION_ERROR" ? 422 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : "Failed to extract citations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
