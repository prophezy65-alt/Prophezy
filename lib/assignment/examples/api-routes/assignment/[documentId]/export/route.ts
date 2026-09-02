// EXAMPLE: app/api/assignment/[documentId]/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { exportAssignment, buildExportableAssignment } from "@/lib/assignment/services/export.service";
import { validateExportRequest } from "@/lib/assignment/validation/schemas";
import type { AssignmentDocument, QuestionSolution, QuizQuestion, Flashcard, ExportFormat } from "@/lib/assignment/models/types";

declare function getCurrentUserId(req: NextRequest): Promise<string>;
declare function loadDocumentWithArtifacts(documentId: string): Promise<{
  document: AssignmentDocument;
  solutions: Map<string, QuestionSolution>;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
} | null>;

export async function POST(req: NextRequest, { params }: { params: { documentId: string } }): Promise<NextResponse> {
  await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = validateExportRequest(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const requestBody = body as {
    format: ExportFormat;
    includeSolutions?: boolean;
    includeQuizzes?: boolean;
    includeFlashcards?: boolean;
    includeReferences?: boolean;
  };

  const loaded = await loadDocumentWithArtifacts(params.documentId);
  if (!loaded) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const exportRequest = {
    documentId: params.documentId,
    format: requestBody.format,
    includeSolutions: requestBody.includeSolutions ?? true,
    includeQuizzes: requestBody.includeQuizzes ?? false,
    includeFlashcards: requestBody.includeFlashcards ?? false,
    includeReferences: requestBody.includeReferences ?? true,
  };

  const bundle = buildExportableAssignment(
    loaded.document,
    loaded.solutions,
    loaded.quiz,
    loaded.flashcards,
    exportRequest
  );

  try {
    const result = await exportAssignment(bundle, exportRequest);
    return new NextResponse(new Blob([new Uint8Array(result.buffer)]), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Export failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
