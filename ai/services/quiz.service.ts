/**
 * lib/ai/services/quiz.service.ts
 */
import { runStructured } from "./_run-structured";
import { QUIZ_PROMPT, type QuizInput, type QuizOutput } from "../prompts/quiz";

export function generateQuiz(
  userId: string,
  input: QuizInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<QuizOutput> {
  return runStructured(QUIZ_PROMPT, { userId, input, ...opts });
}
