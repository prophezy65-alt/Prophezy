import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteKnowledgeGraph } from "@/lib/research/services/knowledge-graph.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** DELETE /api/research/knowledge-graph/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    await deleteKnowledgeGraph(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ error: "Failed to delete knowledge graph." }, { status: 500 });
  }
}
