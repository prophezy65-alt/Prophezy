/**
 * lib/interview/evaluation/evaluation.service.ts
 */
import { runStructured } from "../../ai/services/_run-structured";
import { EVALUATION_PROMPT, type EvaluationInput, type EvaluationOutput } from "../prompts/evaluation";

export function evaluateAnswer(
  userId: string,
  input: EvaluationInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<EvaluationOutput> {
  return runStructured(EVALUATION_PROMPT, { userId, input, ...opts });
}

/** Simple average fallback if a caller wants a quick score without a full evaluation call. */
export function averageScore(scores: EvaluationOutput["scores"]): number {
  const values = Object.values(scores);
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
