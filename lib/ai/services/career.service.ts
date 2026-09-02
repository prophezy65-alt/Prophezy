/**
 * lib/ai/services/career.service.ts
 */
import { runStructured } from "./_run-structured";
import { CAREER_PROMPT, type CareerInput, type CareerOutput } from "../prompts/career";

export function getCareerAdvice(
  userId: string,
  input: CareerInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<CareerOutput> {
  return runStructured(CAREER_PROMPT, { userId, input, ...opts });
}
