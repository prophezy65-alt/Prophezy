import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { getDocumentDetail } from "@/lib/assignment-db/repository";
import { runQualityChecks } from "@/lib/assignment/services/validator.service";
import { AssignmentAiError } from "@/lib/assignment/providers/ai-engine.provider";
import type { ReferenceEntry } from "@/lib/assignment/models/types";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ documentId: string }> }): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = params ? await params : null;
  const documentId = resolvedParams?.documentId;
  if (!documentId) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }
  const detail = await getDocumentDetail(user.id, documentId);
  if (!detail) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const answerTexts = new Map<string, string>();
  const references: ReferenceEntry[] = [];

  for (const [questionId, byDepth] of Object.entries(detail.solutions)) {
    const preferred = byDepth.standard ?? byDepth.simple ?? byDepth.technical;
    if (!preferred) continue;
    answerTexts.set(questionId, preferred.finalAnswer);
    references.push(...preferred.references);
  }

  if (answerTexts.size === 0) {
    return NextResponse.json(
      { error: "No generated solutions yet — generate at least one solution before running a quality check." },
      { status: 400 },
    );
  }

  try {
    const report = await runQualityChecks(detail.questions, answerTexts, references, { userId: user.id, documentId });
    return NextResponse.json({ report }, { status: 200 });
  } catch (err) {
    if (err instanceof AssignmentAiError) {
      return NextResponse.json({ error: "Quality check failed", message: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Failed to run quality check", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
