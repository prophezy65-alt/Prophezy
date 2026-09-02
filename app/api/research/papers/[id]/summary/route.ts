import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePaperSummary } from "@/lib/research/services/summary.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/research/papers/[id]/summary — body: { forceRefresh?: boolean } */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const forceRefresh = Boolean(body?.forceRefresh);

  try {
    const result = await generatePaperSummary(user.id, id, { forceRefresh });
    return NextResponse.json(result);
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "PAPER_NOT_FOUND" ? 404 : error.code === "SUMMARY_GENERATION_ERROR" ? 422 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : "Failed to generate summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
