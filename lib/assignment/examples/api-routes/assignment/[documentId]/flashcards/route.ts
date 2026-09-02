// EXAMPLE: app/api/assignment/[documentId]/flashcards/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateFlashcardsForDocument } from "@/lib/assignment/services/flashcard.service";
import type { AssignmentDocument } from "@/lib/assignment/models/types";

declare function getCurrentUserId(req: NextRequest): Promise<string>;
declare function loadDocument(documentId: string): Promise<AssignmentDocument | null>;

export async function POST(req: NextRequest, { params }: { params: { documentId: string } }): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const document = await loadDocument(params.documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const sourceTexts = document.questions.map((q) => q.cleanedText);

  try {
    const flashcards = await generateFlashcardsForDocument(sourceTexts, { userId });
    return NextResponse.json({ flashcards }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate flashcards", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
