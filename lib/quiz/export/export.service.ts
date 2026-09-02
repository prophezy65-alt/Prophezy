/**
 * lib/quiz/export/export.service.ts
 *
 * Renders a quiz to any of the 6 supported export formats. Markdown/HTML/
 * JSON/CSV are generated directly here (cheap, no dependency). PDF/DOCX
 * generation is delegated to whatever existing document-generation utility
 * Resume Studio / Assignment AI already use for their own PDF/DOCX exports
 * (reused, not reimplemented) — see the TODO marker below for the one wire
 * -up this file can't complete without seeing that utility's signature.
 */

import { markdownToHtml, markdownToPlainText } from "../../ai/utils/formatter";
import type { Quiz, QuizQuestion } from "../models/quiz.types";
import { exportQuizRequestSchema, type ExportQuizRequest } from "../validation/quiz-schemas";

export interface ExportedFile {
  filename: string;
  mimeType: string;
  content: string | Buffer;
}

export async function exportQuiz(
  request: ExportQuizRequest,
  quiz: Quiz,
  questions: QuizQuestion[]
): Promise<ExportedFile> {
  const input = exportQuizRequestSchema.parse(request);
  const safeTitle = quiz.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  switch (input.format) {
    case "markdown":
      return {
        filename: `${safeTitle}.md`,
        mimeType: "text/markdown",
        content: toMarkdown(quiz, questions, input.includeAnswers),
      };

    case "html":
      return {
        filename: `${safeTitle}.html`,
        mimeType: "text/html",
        content: `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
          quiz.title
        )}</title></head><body>${markdownToHtml(toMarkdown(quiz, questions, input.includeAnswers))}</body></html>`,
      };

    case "json":
      return {
        filename: `${safeTitle}.json`,
        mimeType: "application/json",
        content: JSON.stringify(toExportJson(quiz, questions, input.includeAnswers), null, 2),
      };

    case "csv":
      return {
        filename: `${safeTitle}.csv`,
        mimeType: "text/csv",
        content: toCsv(questions, input.includeAnswers),
      };

    case "pdf":
    case "docx":
      // Prophezy already generates PDF/DOCX for Resume Studio and Assignment
      // AI exports — reuse that utility rather than adding a second PDF/DOCX
      // pipeline here. This file's job stops at producing clean markdown;
      // wire the actual call once that utility's export/import path is
      // confirmed, e.g.:
      //
      //   import { markdownToPdf } from "@/lib/documents/pdf-export"; (assumed path)
      //   return { filename: `${safeTitle}.pdf`, mimeType: "application/pdf",
      //            content: await markdownToPdf(toMarkdown(quiz, questions, input.includeAnswers)) };
      throw new Error(
        `${input.format.toUpperCase()} export needs to be wired to the existing document-export utility ` +
          `(the one Resume Studio/Assignment AI already use) — see comment above this line for the exact hookup.`
      );

    default: {
      const _exhaustive: never = input.format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }
}

function toMarkdown(quiz: Quiz, questions: QuizQuestion[], includeAnswers: boolean): string {
  const lines = [`# ${quiz.title}`, ``, `*${quiz.examMode} · ${quiz.difficulty} · ${questions.length} questions*`, ``];

  questions.forEach((q, i) => {
    lines.push(`## ${i + 1}. ${q.questionText} _(${q.marks} mark${q.marks === 1 ? "" : "s"})_`);
    if (q.options) {
      for (const opt of q.options) lines.push(`- **${opt.key}.** ${opt.text}`);
    }
    if (includeAnswers) {
      if (q.correctOption) lines.push(``, `**Answer:** ${q.correctOption}`);
      if (q.explanation) lines.push(``, `**Explanation:** ${q.explanation}`);
    }
    lines.push(``);
  });

  return lines.join("\n");
}

function toExportJson(quiz: Quiz, questions: QuizQuestion[], includeAnswers: boolean) {
  return {
    title: quiz.title,
    examMode: quiz.examMode,
    difficulty: quiz.difficulty,
    questionCount: questions.length,
    questions: questions.map((q) => ({
      questionText: q.questionText,
      questionType: q.questionType,
      marks: q.marks,
      difficulty: q.difficulty,
      options: q.options,
      ...(includeAnswers
        ? { correctOption: q.correctOption, explanation: q.explanation, stepSolution: q.stepSolution }
        : {}),
    })),
  };
}

function toCsv(questions: QuizQuestion[], includeAnswers: boolean): string {
  const headers = ["#", "Question", "Type", "Difficulty", "Marks", ...(includeAnswers ? ["Correct Answer"] : [])];
  const rows = questions.map((q, i) => [
    String(i + 1),
    csvEscape(q.questionText),
    q.questionType,
    q.difficulty,
    String(q.marks),
    ...(includeAnswers ? [csvEscape(q.correctOption ?? "")] : []),
  ]);
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Re-exported for callers that want a plain-text preview (e.g. email
// notification "your quiz is ready") without a full export.
export { markdownToPlainText };
