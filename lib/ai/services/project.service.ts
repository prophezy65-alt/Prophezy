/**
 * lib/ai/services/project.service.ts
 */
import { runStructured } from "./_run-structured";
import { PROJECT_PROMPT, type ProjectGenInput, type ProjectGenOutput } from "../prompts/project";

export function generateProjectIdeas(
  userId: string,
  input: ProjectGenInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<ProjectGenOutput> {
  return runStructured(PROJECT_PROMPT, { userId, input, ...opts });
}
