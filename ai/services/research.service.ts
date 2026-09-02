/**
 * lib/ai/services/research.service.ts
 */
import { runStructured } from "./_run-structured";
import { RESEARCH_PROMPT, type ResearchInput, type ResearchOutput } from "../prompts/research";

export function runResearch(
  userId: string,
  input: ResearchInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<ResearchOutput> {
  return runStructured(RESEARCH_PROMPT, { userId, input, ...opts });
}
