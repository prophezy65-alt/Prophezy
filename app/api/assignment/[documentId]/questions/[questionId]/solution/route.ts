import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { getQuestion, getSolution, saveSolution } from "@/lib/assignment-db/repository";
import { generateSolution } from "@/lib/assignment/services/generator.service";
import { AssignmentAiError } from "@/lib/assignment/providers/ai-engine.provider";
import type { ExplanationDepth } from "@/lib/assignment/services/generator.service";

const VALID_DEPTHS: ExplanationDepth[] = ["simple", "standard", "technical"];

function parseDepth(value: string | null): ExplanationDepth {
  return value && VALID_DEPTHS.includes(value as ExplanationDepth) ? (value as ExplanationDepth) : "standard";
}

type RouteParams = Promise<{ documentId: string; questionId: string }>;

async function resolveParams(params: RouteParams): Promise<{ documentId: string; questionId: string } | null> {
  if (!params) return null;
  const resolved = await params;
  if (!resolved?.documentId || !resolved?.questionId) return null;
  return resolved;
}

export async function GET(req: NextRequest, { params }: { params: RouteParams }): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveParams(params);
  if (!resolved) return NextResponse.json({ error: "Missing document or question id" }, { status: 400 });

  const question = await getQuestion(user.id, resolved.documentId, resolved.questionId);
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const depthMode = parseDepth(new URL(req.url).searchParams.get("depthMode"));
  const solution = await getSolution(resolved.questionId, depthMode);

  return NextResponse.json({ solution, cached: solution !== null }, { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: RouteParams }): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveParams(params);
  if (!resolved) return NextResponse.json({ error: "Missing document or question id" }, { status: 400 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — depthMode defaults to "standard"
  }
  const requested = (body as { depthMode?: string }).depthMode ?? null;
  const forceRefresh = (body as { forceRefresh?: boolean }).forceRefresh === true;
  const depthMode = parseDepth(requested);

  const question = await getQuestion(user.id, resolved.documentId, resolved.questionId);
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  if (!forceRefresh) {
    const cached = await getSolution(resolved.questionId, depthMode);
    if (cached) return NextResponse.json({ solution: cached, cached: true }, { status: 200 });
  }

  try {
    const solution = await generateSolution(question, { userId: user.id, depthMode });
    await saveSolution(resolved.questionId, depthMode, solution);
    return NextResponse.json({ solution, cached: false }, { status: 200 });
  } catch (err) {
    if (err instanceof AssignmentAiError) {
      return NextResponse.json({ error: "AI solution generation failed", message: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Failed to generate solution", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
