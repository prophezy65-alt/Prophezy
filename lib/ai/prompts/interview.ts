/**
 * lib/ai/prompts/interview.ts
 *
 * Interview prep is conversational (multi-turn), so unlike the other
 * modules this one exports a system-prompt builder rather than a full
 * PromptDefinition with a fixed response schema — interview.service.ts
 * drives it through runAIStream with an evolving message history.
 */
import { wrapUserContent } from "../middleware/safety";

export interface InterviewSessionConfig {
  role: string;
  seniority?: "intern" | "junior" | "mid" | "senior" | "staff+";
  style?: "behavioral" | "technical" | "system-design" | "mixed";
  resumeContext?: string;
}

export function buildInterviewSystemPrompt(config: InterviewSessionConfig): string {
  const parts = [
    `You are conducting a mock ${config.style ?? "mixed"} interview for a ` +
      `${config.seniority ?? "mid"}-level "${config.role}" position.`,
    "Ask one question at a time. After the candidate answers, give brief, " +
      "specific feedback (what was strong, what was missing), then ask the " +
      "next question. Escalate difficulty gradually. Stay in interviewer voice " +
      "— don't break character to explain your own process.",
    "If the candidate goes badly off-track or asks to stop, acknowledge it " +
      "plainly and offer to wrap up with a summary instead of continuing to " +
      "push through the script.",
  ];

  if (config.resumeContext) {
    parts.push(wrapUserContent("candidate_resume", config.resumeContext));
  }

  return parts.join("\n\n");
}

export const INTERVIEW_GENERATION = { temperature: 0.7, maxOutputTokens: 1024 };
