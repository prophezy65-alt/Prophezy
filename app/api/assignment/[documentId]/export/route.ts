import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { getDocumentDetail, getDocumentRow, recordExport } from "@/lib/assignment-db/repository";
import { toExportableDocument } from "@/lib/assignment-db/mappers";
import { validateExportRequest } from "@/lib/assignment/validation/schemas";
import { exportAssignment, buildExportableAssignment } from "@/lib/assignment/services/export.service";
import type { ExportFormat } from "@/lib/assignment/models/types";
import type { QuestionSolution } from "@/lib/assignment/models/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = params ? await params : null;
  const documentId = resolvedParams?.documentId;
  if (!documentId) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const withDocId = { ...(body as Record<string, unknown>), documentId };
  const validation = validateExportRequest(withDocId);
  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const detail = await getDocumentDetail(user.id, documentId);
  const docRow = await getDocumentRow(user.id, documentId);
  if (!detail || !docRow) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const request = withDocId as {
    documentId: string;
    format: ExportFormat;
    includeSolutions?: boolean;
    includeQuizzes?: boolean;
    includeFlashcards?: boolean;
    includeReferences?: boolean;
  };

  const document = toExportableDocument(docRow, detail.questions);

  const solutions = new Map<string, QuestionSolution>();
  for (const [questionId, byDepth] of Object.entries(detail.solutions)) {
    const preferred = byDepth.standard ?? byDepth.simple ?? byDepth.technical;
    if (preferred) solutions.set(questionId, preferred);
  }

  const bundle = buildExportableAssignment(document, solutions, [], [], {
    includeSolutions: request.includeSolutions ?? true,
    includeQuizzes: false,
    includeFlashcards: false,
    includeReferences: request.includeReferences ?? true,
  });

  try {
    const result = await exportAssignment(bundle, {
      documentId,
      format: request.format,
      includeSolutions: request.includeSolutions ?? true,
      includeQuizzes: false,
      includeFlashcards: false,
      includeReferences: request.includeReferences ?? true,
    });

    await recordExport(user.id, documentId, result.format, result.fileName);

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to export assignment", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
