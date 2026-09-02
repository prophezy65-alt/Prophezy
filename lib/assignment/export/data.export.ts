// lib/assignment/export/data.export.ts
import type { ExportableAssignment } from "./exportable-content";
import { buildCsv } from "../utils/export-utility";
import { safeJsonStringify } from "../utils/json-parser";

export function exportToJson(bundle: ExportableAssignment): string {
  const payload = {
    document: {
      id: bundle.document.id,
      title: bundle.document.title,
      subject: bundle.document.detectedSubjectArea,
      createdAt: bundle.document.createdAt,
    },
    questions: bundle.document.questions.map((q) => ({
      ...q,
      solution: bundle.includeSolutions ? bundle.solutions.get(q.id) ?? null : null,
    })),
    quiz: bundle.includeQuizzes ? bundle.quiz : [],
    flashcards: bundle.includeFlashcards ? bundle.flashcards : [],
  };

  const result = safeJsonStringify(payload, true);
  if (!result.success || result.data === null) {
    throw new Error(`Failed to serialize export payload: ${result.error}`);
  }
  return result.data;
}

export function exportToCsv(bundle: ExportableAssignment): string {
  const headers = [
    "Question Number",
    "Type",
    "Subject",
    "Topic",
    "Difficulty",
    "Marks",
    "Question Text",
    "Final Answer",
  ];

  const rows = bundle.document.questions.map((q) => {
    const solution = bundle.includeSolutions ? bundle.solutions.get(q.id) : undefined;
    return [
      q.questionNumber,
      q.type,
      q.subject,
      q.topic,
      q.difficulty,
      q.marks,
      q.cleanedText,
      solution ? solution.finalAnswer : "",
    ];
  });

  return buildCsv(headers, rows);
}
