/**
 * lib/ai/services/roadmap.service.ts
 */
import { runStructured } from "./_run-structured";
import { ROADMAP_PROMPT, type RoadmapInput, type RoadmapOutput } from "../prompts/roadmap";

export function generateRoadmap(
  userId: string,
  input: RoadmapInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<RoadmapOutput> {
  return runStructured(ROADMAP_PROMPT, { userId, input, ...opts });
}
