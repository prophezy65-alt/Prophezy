/**
 * lib/interview/company/company.service.ts
 */
import { runStructured } from "../../ai/services/_run-structured";
import {
  COMPANY_CONTEXT_PROMPT,
  type CompanyContextInput,
  type CompanyContextOutput,
} from "../prompts/company-context";

export function getCompanyContext(
  userId: string,
  input: CompanyContextInput,
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<CompanyContextOutput> {
  // forceRefresh defaults to false: company context is slow-changing and
  // benefits from the response cache far more than per-session data does.
  return runStructured(COMPANY_CONTEXT_PROMPT, { userId, input, ...opts });
}

/** Flattens a company context profile into extra job-description-style text for question generation. */
export function companyContextToPromptContext(context: CompanyContextOutput): string {
  return [
    `Known focus areas: ${context.knownFocusAreas.join(", ")}`,
    `Typical rounds: ${context.typicalRounds.join(", ")}`,
    context.notes,
  ].join("\n");
}
