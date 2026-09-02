// lib/humanizer/services/rewrite.service.ts
import { rewritePrompt } from "../prompts/rewrite";
import { runHumanizerPrompt } from "../providers/ai-engine.provider";
import type { RewriteOptions } from "../models/types";

export interface RunRewriteOptions {
  userId: string;
}

export interface RewriteOutcome {
  rewrittenText: string;
  changesSummary: string;
  preservedFactsNote: string;
}

const MAX_INPUT_CHARS = 30000;

export class RewriteInputTooLargeError extends Error {
  constructor(actualLength: number) {
    super(`Input text (${actualLength} chars) exceeds the ${MAX_INPUT_CHARS} character limit for a single rewrite`);
    this.name = "RewriteInputTooLargeError";
  }
}

export async function runRewrite(
  text: string,
  options: RewriteOptions,
  callOptions: RunRewriteOptions
): Promise<RewriteOutcome> {
  if (text.length > MAX_INPUT_CHARS) {
    throw new RewriteInputTooLargeError(text.length);
  }
  if (text.trim().length === 0) {
    return { rewrittenText: "", changesSummary: "No content provided.", preservedFactsNote: "N/A" };
  }

  // Rewrite quality benefits from the larger model; humanize/academic/professional
  // styles in particular need nuanced judgment about what reads as natural.
  const routingHint = options.style === "resume_bullet" || options.lengthOp !== "none" ? "flash" : "pro";

  const result = await runHumanizerPrompt(
    rewritePrompt,
    {
      text,
      style: options.style,
      tone: options.tone,
      lengthOp: options.lengthOp,
      domain: options.domain,
    },
    { userId: callOptions.userId, routingHint }
  );

  return result;
}
