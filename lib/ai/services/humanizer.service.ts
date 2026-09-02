/**
 * lib/ai/services/humanizer.service.ts
 */
import { runStructured } from "./_run-structured";
import { HUMANIZER_PROMPT, type HumanizerInput, type HumanizerOutput } from "../prompts/humanizer";

export function humanizeText(
  userId: string,
  input: HumanizerInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<HumanizerOutput> {
  return runStructured(HUMANIZER_PROMPT, { userId, input, ...opts });
}
