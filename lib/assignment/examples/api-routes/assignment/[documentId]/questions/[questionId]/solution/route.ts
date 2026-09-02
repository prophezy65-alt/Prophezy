// EXAMPLE: app/api/assignment/[documentId]/questions/[questionId]/solution/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateSolution } from "@/lib/assignment/services/generator.service";
import { validateGenerateSolutionRequest } from "@/lib/assignment/validation/schemas";
import type { DetectedQuestion } from "@/lib/assignment/models/types";

declare function getCurrentUserId(req: NextRequest): Promise<string>;
// Replace with your existing data access — fetch the previously-detected
// question by ID (from wherever the frontend cached processAssignmentBatch's
// output, e.g. a documents table or client-side state re-submitted here).
declare function loadQuestionById(documentId: string, questionId: string): Promise<DetectedQuestion | null>;

export async function POST(
  req: NextRequest,
  { params }: { params: { documentId: string; questionId: string } }
): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = validateGenerateSolutionRequest(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const { depthMode } = body as { depthMode?: "simple" | "standard" | "technical" };

  const question = await loadQuestionById(params.documentId, params.questionId);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  try {
    const solution = await generateSolution(question, { userId, depthMode });
    return NextResponse.json({ solution }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate solution", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
