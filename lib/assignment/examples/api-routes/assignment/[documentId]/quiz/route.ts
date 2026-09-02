// EXAMPLE: app/api/assignment/[documentId]/quiz/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateQuiz, gradeQuiz } from "@/lib/assignment/services/quiz.service";
import type { AssignmentDocument, QuizQuestion } from "@/lib/assignment/models/types";

declare function getCurrentUserId(req: NextRequest): Promise<string>;
declare function loadDocument(documentId: string): Promise<AssignmentDocument | null>;
declare function loadQuizForDocument(documentId: string): Promise<QuizQuestion[] | null>;

// POST /api/assignment/[documentId]/quiz — generate a new quiz
export async function POST(req: NextRequest, { params }: { params: { documentId: string } }): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const document = await loadDocument(params.documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const sourceText = document.questions.map((q) => q.cleanedText).join("\n\n");

  try {
    const quiz = await generateQuiz(sourceText, { userId, questionCount: 8, difficultyMix: "mixed" });
    return NextResponse.json({ quiz }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate quiz", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PUT /api/assignment/[documentId]/quiz — submit answers for grading
export async function PUT(req: NextRequest, { params }: { params: { documentId: string } }): Promise<NextResponse> {
  const body: unknown = await req.json();
  if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).answers)) {
    return NextResponse.json({ error: "`answers` must be an array of { questionId, answer }" }, { status: 400 });
  }

  const { answers } = body as { answers: { questionId: string; answer: string }[] };
  const quiz = await loadQuizForDocument(params.documentId);
  if (!quiz) {
    return NextResponse.json({ error: "No quiz found for this document — generate one first" }, { status: 404 });
  }

  const submittedAnswers = new Map(answers.map((a) => [a.questionId, a.answer]));
  const { results, scorePercent } = gradeQuiz(quiz, submittedAnswers);

  return NextResponse.json({ results, scorePercent }, { status: 200 });
}
