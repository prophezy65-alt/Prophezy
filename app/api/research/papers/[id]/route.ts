import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPaper, deletePaper } from "@/lib/research/services/paper.service";
import { listCitations } from "@/lib/research/services/citation.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/research/papers/[id] — paper detail, including any already-extracted citations. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const [paper, citations] = await Promise.all([getPaper(user.id, id), listCitations(user.id, id)]);
    return NextResponse.json({ paper, citations });
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "PAPER_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Failed to load paper." }, { status: 500 });
  }
}

/** DELETE /api/research/papers/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    await deletePaper(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "PAPER_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ error: "Failed to delete paper." }, { status: 500 });
  }
}
