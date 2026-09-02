/**
 * lib/quiz/utils/sanitize.ts
 *
 * Strips answer-revealing fields from a question before it's sent to a
 * client that is actively taking the quiz. Explanations/correct answers are
 * only safe to send once an attempt is graded (see the results route).
 */

import type { QuizQuestion } from "../models/quiz.types";

export type SanitizedQuestion = Omit<QuizQuestion, "correctOption" | "explanation" | "stepSolution" | "metadata"> & {
  metadata: Record<string, unknown>;
};

export function sanitizeQuestionForAttempt(question: QuizQuestion): SanitizedQuestion {
  const { correctOption, explanation, stepSolution, metadata, ...rest } = question;

  // Strip answer keys out of metadata too (multiple_select.correctOptions, ordering.correctOrder, etc.)
  // while keeping everything a player needs to render the question.
  const safeMetadata: Record<string, unknown> = (() => {
    switch (metadata.kind) {
      case "multiple_select":
        return { kind: "multiple_select", options: metadata.options };
      case "ordering":
        return { kind: "ordering", items: metadata.items };
      case "match_following":
        return { kind: "match_following", pairs: metadata.pairs.map((p) => ({ left: p.left })) };
      case "code":
        return { kind: "code", language: metadata.language, starterCode: metadata.starterCode };
      case "subject_response":
        return { kind: "subject_response" };
      default:
        return { kind: "generic" };
    }
  })();

  return { ...rest, metadata: safeMetadata };
}
