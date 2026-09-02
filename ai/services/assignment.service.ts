/**
 * lib/ai/services/assignment.service.ts
 */
import { runStructured } from "./_run-structured";
import { ASSIGNMENT_PROMPT, type AssignmentInput, type AssignmentOutput } from "../prompts/assignment";

export function solveAssignment(
  userId: string,
  input: AssignmentInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<AssignmentOutput> {
  return runStructured(ASSIGNMENT_PROMPT, { userId, input, ...opts });
}
