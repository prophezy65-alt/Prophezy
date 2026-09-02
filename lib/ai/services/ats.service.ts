/**
 * lib/ai/services/ats.service.ts
 */
import { runStructured } from "./_run-structured";
import { ATS_PROMPT, type AtsCheckInput, type AtsCheckOutput } from "../prompts/ats";

export function checkAts(
  userId: string,
  input: AtsCheckInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<AtsCheckOutput> {
  return runStructured(ATS_PROMPT, { userId, input, ...opts });
}
