// lib/assignment/services/formatter.service.ts
import { formatterPrompt, type RewriteRegister } from "../prompts/formatter";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";

export interface RewriteTextOptions {
  userId: string;
  register: RewriteRegister;
}

export interface RewriteResult {
  rewrittenText: string;
  changesSummary: string;
}

export async function rewriteTextRegister(text: string, options: RewriteTextOptions): Promise<RewriteResult> {
  if (text.trim().length === 0) {
    return { rewrittenText: "", changesSummary: "No content to rewrite." };
  }

  const result = await runAssignmentPrompt(
    formatterPrompt,
    { text, register: options.register },
    { userId: options.userId }
  );

  return { rewrittenText: result.rewrittenText, changesSummary: result.changesSummary };
}

/** Convenience wrappers matching the platform's named quality-check features
 * ("Academic Tone Improver", "Professional Tone", "Simple Explanation",
 * "Technical Explanation") so callers don't need to remember string literals. */
export const improveAcademicTone = (text: string, userId: string) =>
  rewriteTextRegister(text, { userId, register: "academic" });

export const improveProfessionalTone = (text: string, userId: string) =>
  rewriteTextRegister(text, { userId, register: "professional" });

export const simplifyExplanation = (text: string, userId: string) =>
  rewriteTextRegister(text, { userId, register: "simple" });

export const technicalExplanation = (text: string, userId: string) =>
  rewriteTextRegister(text, { userId, register: "technical" });
