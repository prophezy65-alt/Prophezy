// lib/assignment/services/quiz.service.ts
import { randomUUID } from "crypto";
import type { QuizQuestion } from "../models/types";
import { quizPrompt } from "../prompts/quiz";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";

export interface GenerateQuizOptions {
  userId: string;
  questionCount?: number;
  difficultyMix?: "easy" | "mixed" | "hard";
}

export async function generateQuiz(
  sourceText: string,
  options: GenerateQuizOptions
): Promise<QuizQuestion[]> {
  if (sourceText.trim().length === 0) return [];

  const result = await runAssignmentPrompt(
    quizPrompt,
    {
      sourceText,
      questionCount: options.questionCount ?? 5,
      difficultyMix: options.difficultyMix ?? "mixed",
    },
    { userId: options.userId }
  );

  return result.questions.map((q) => ({
    id: randomUUID(),
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));
}

/** Grades a set of submitted answers against a previously generated quiz.
 * Deterministic string comparison for mcq/true_false (exact match against
 * the stored correctAnswer); short_answer uses a lenient normalized
 * comparison since exact wording match is unreasonable to expect. */
export interface QuizGradeResult {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

export function gradeQuiz(
  quiz: QuizQuestion[],
  submittedAnswers: Map<string, string>
): { results: QuizGradeResult[]; scorePercent: number } {
  const results: QuizGradeResult[] = quiz.map((q) => {
    const submitted = (submittedAnswers.get(q.id) ?? "").trim();
    const isCorrect =
      q.type === "short_answer"
        ? normalizeForComparison(submitted) === normalizeForComparison(q.correctAnswer)
        : submitted.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

    return { questionId: q.id, isCorrect, correctAnswer: q.correctAnswer, explanation: q.explanation };
  });

  const correctCount = results.filter((r) => r.isCorrect).length;
  const scorePercent = quiz.length === 0 ? 0 : Math.round((correctCount / quiz.length) * 100);

  return { results, scorePercent };
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
