import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildKnowledgeGraph, listKnowledgeGraphs } from "@/lib/research/services/knowledge-graph.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/research/knowledge-graph — the user's saved knowledge graphs. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const graphs = await listKnowledgeGraphs(user.id);
    return NextResponse.json({ graphs });
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ error: "Failed to list knowledge graphs." }, { status: 500 });
  }
}

/** POST /api/research/knowledge-graph — body: { topic: string, paperIds: string[] } */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: { topic?: string; paperIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.topic?.trim() || !Array.isArray(body.paperIds)) {
    return NextResponse.json({ error: "`topic` and `paperIds` are required." }, { status: 400 });
  }

  try {
    const graph = await buildKnowledgeGraph(user.id, body.topic.trim(), body.paperIds);
    return NextResponse.json({ graph }, { status: 201 });
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "RESEARCH_VALIDATION_ERROR" ? 400 : error.code === "PAPER_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : "Failed to build knowledge graph.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
