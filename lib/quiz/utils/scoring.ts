/**
 * lib/quiz/utils/scoring.ts
 *
 * Pure functions for local (non-AI) grading of exact_match and set_match
 * question types, and for rolling per-response marks into an attempt's
 * final score with negative marking applied. AI-graded types are scored by
 * grading.service.ts via grading.prompt.ts — this file never calls the AI.
 */

import type {
  McqOption,
  QuestionMetadata,
  QuizQuestion,
  ResponsePayload,
} from "../models/quiz.types";

export interface LocalGradeResult {
  isCorrect: boolean;
  marksAwarded: number;
}

/** Grades exact_match and set_match question types locally, with no AI call. */
export function gradeLocally(question: QuizQuestion, response: ResponsePayload): LocalGradeResult {
  switch (question.questionType) {
    case "mcq":
    case "true_false":
      return gradeExact(question.correctOption, typeof response === "string" ? response : null, question.marks);

    case "fill_in_blank":
    case "one_word": {
      const variants = (question.metadata as any)?.acceptableVariants as string[] | undefined;
      return gradeExactWithVariants(
        question.correctOption,
        variants ?? [],
        typeof response === "string" ? response : null,
        question.marks
      );
    }

    case "multiple_select": {
      const meta = question.metadata as Extract<QuestionMetadata, { kind: "multiple_select" }>;
      const submitted = Array.isArray(response) && typeof response[0] !== "object" ? (response as string[]) : [];
      return gradeSet(meta.correctOptions, submitted, question.marks);
    }

    case "ordering": {
      const meta = question.metadata as Extract<QuestionMetadata, { kind: "ordering" }>;
      const submitted = Array.isArray(response) ? (response as unknown as number[]) : [];
      const correct = arraysEqual(meta.correctOrder, submitted);
      return { isCorrect: correct, marksAwarded: correct ? question.marks : 0 };
    }

    case "match_following": {
      const meta = question.metadata as Extract<QuestionMetadata, { kind: "match_following" }>;
      const submitted = Array.isArray(response) ? (response as unknown as Array<{ left: string; right: string }>) : [];
      const correctCount = meta.pairs.filter((pair) =>
        submitted.some((s) => s.left === pair.left && s.right === pair.right)
      ).length;
      const fraction = meta.pairs.length > 0 ? correctCount / meta.pairs.length : 0;
      const marksAwarded = round2(fraction * question.marks);
      return { isCorrect: correctCount === meta.pairs.length, marksAwarded };
    }

    default:
      throw new Error(
        `gradeLocally() called for AI-graded question type "${question.questionType}". ` +
          `Use grading.service.ts#gradeWithAi instead.`
      );
  }
}

function gradeExact(correct: string | null, submitted: string | null, marks: number): LocalGradeResult {
  const isCorrect = correct !== null && submitted !== null && normalize(correct) === normalize(submitted);
  return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
}

function gradeExactWithVariants(
  correct: string | null,
  variants: string[],
  submitted: string | null,
  marks: number
): LocalGradeResult {
  if (submitted === null) return { isCorrect: false, marksAwarded: 0 };
  const accepted = [correct, ...variants].filter((v): v is string => v !== null).map(normalize);
  const isCorrect = accepted.includes(normalize(submitted));
  return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
}

function gradeSet(correct: string[], submitted: string[], marks: number): LocalGradeResult {
  const correctSet = new Set(correct.map(normalize));
  const submittedSet = new Set(submitted.map(normalize));
  const isCorrect = correctSet.size === submittedSet.size && [...correctSet].every((c) => submittedSet.has(c));
  return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- attempt-level rollup --------------------------------------------

export interface ScoreRollupInput {
  responses: Array<{ marksAwarded: number | null; isCorrect: boolean | null; maxMarks: number }>;
  negativeMarking: number; // fraction of a question's marks deducted per wrong answer
}

export interface ScoreRollup {
  rawScore: number;
  finalScore: number;
  maxScore: number;
  accuracyPct: number; // correct / attempted
  completionPct: number; // attempted / total
}

export function rollupScore(input: ScoreRollupInput): ScoreRollup {
  const total = input.responses.length;
  const attempted = input.responses.filter((r) => r.marksAwarded !== null);
  const maxScore = round2(input.responses.reduce((sum, r) => sum + r.maxMarks, 0));

  let raw = 0;
  let penalty = 0;
  let correctCount = 0;

  for (const r of attempted) {
    raw += r.marksAwarded ?? 0;
    if (r.isCorrect) correctCount += 1;
    else if (input.negativeMarking > 0) penalty += r.maxMarks * input.negativeMarking;
  }

  const rawScore = round2(raw);
  const finalScore = round2(Math.max(0, raw - penalty));
  const accuracyPct = attempted.length > 0 ? round2((correctCount / attempted.length) * 100) : 0;
  const completionPct = total > 0 ? round2((attempted.length / total) * 100) : 0;

  return { rawScore, finalScore, maxScore, accuracyPct, completionPct };
}
