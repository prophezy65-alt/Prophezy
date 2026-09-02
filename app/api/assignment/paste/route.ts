import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { saveDocument, saveSolution } from "@/lib/assignment-db/repository";
import { detectQuestions } from "@/lib/assignment/services/question.service";
import { generateSolutionsForDocument } from "@/lib/assignment/services/generator.service";
import { extractMarkdownTables, extractAlignedTables } from "@/lib/assignment/utils/table-parser";
import { extractEquations } from "@/lib/assignment/utils/equation-parser";
import type { StructuredExtraction } from "@/lib/assignment/models/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/assignment/paste — solve pasted question text directly, with no
// file upload at all. Mirrors app/api/assignment/upload/route.ts's pipeline
// (detect -> solve -> save) but skips parser.service.ts entirely, since
// there's no file to extract from — the pasted text already IS the content.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: unknown; subject?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const mode = body.mode === "short" ? "short" : "full"; // default: full tutoring depth — pasted content is usually 1-2 questions, not a whole paper, so the latency tradeoff favors depth

  if (text.length < 5) {
    return NextResponse.json({ error: "Paste in the question text first." }, { status: 400 });
  }
  if (text.length > 20000) {
    return NextResponse.json({ error: "That's too long to paste directly — upload it as a file instead." }, { status: 400 });
  }

  const fileId = randomUUID();
  const batchId = randomUUID();

  const extraction: StructuredExtraction = {
    fileId,
    pages: [{ pageNumber: 1, rawText: text, confidence: 1.0, source: "native_text" }],
    tables: extractMarkdownTables(text).length ? extractMarkdownTables(text) : extractAlignedTables(text),
    equations: extractEquations(text),
    figures: [],
    fullText: text,
    language: "en",
    hasHandwriting: false,
    extractionWarnings: [],
  };

  try {
    const { questions, detectedSubjectArea } = await detectQuestions(extraction, { userId: user.id, fileId });

    if (questions.length === 0) {
      return NextResponse.json({ error: "Couldn't find a question in that text — try rephrasing or upload it as a file instead." }, { status: 422 });
    }

    const document = {
      id: randomUUID(),
      batchId,
      fileId,
      title: text.slice(0, 60) + (text.length > 60 ? "…" : ""),
      extraction,
      questions,
      detectedSubjectArea,
      createdAt: new Date().toISOString(),
    };

    const summary = await saveDocument({ userId: user.id, uploadId: null, batchId, document, subject });

    const { solutions, failed } = await generateSolutionsForDocument(questions, { userId: user.id, mode }, 8);
    await Promise.all(solutions.map((solution) => saveSolution(solution.questionId, "standard", solution)));

    return NextResponse.json(
      { document: { ...summary, questions, solutions, unsolvedQuestionIds: failed.map((f) => f.questionId) } },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to solve pasted question(s)", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
