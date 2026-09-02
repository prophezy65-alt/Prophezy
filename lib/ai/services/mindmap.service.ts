/**
 * lib/ai/services/mindmap.service.ts
 */
import { runStructured } from "./_run-structured";
import { MINDMAP_PROMPT, type MindmapInput, type MindmapOutput } from "../prompts/mindmap";

export function generateMindmap(
  userId: string,
  input: MindmapInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<MindmapOutput> {
  return runStructured(MINDMAP_PROMPT, { userId, input, ...opts });
}
