/**
 * lib/ai/services/resume.service.ts
 */
import { runStructured } from "./_run-structured";
import { RESUME_PROMPT, type ResumeBuildInput, type ResumeBuildOutput } from "../prompts/resume";

export function buildResume(
  userId: string,
  input: ResumeBuildInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<ResumeBuildOutput> {
  return runStructured(RESUME_PROMPT, { userId, input, ...opts });
}
