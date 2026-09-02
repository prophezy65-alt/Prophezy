/**
 * lib/ai/utils/tokens.ts
 *
 * Two ways to count tokens:
 *  - estimateTokens(): instant, local, no network — good for UI counters and
 *    pre-flight context-window checks before you even call Gemini.
 *  - countTokensExact(): calls Gemini's countTokens endpoint for an exact
 *    number — use before a request you know is close to the context limit.
 */

import type { GeminiMessage } from "../config/client";
import type { GeminiModelId } from "../config/models";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Rough estimate: ~4 characters per token for English text, which is the
 * same heuristic Google and OpenAI both publish as a ballpark. Good enough
 * for progress bars and soft warnings; not for hard limit enforcement.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages: GeminiMessage[]): number {
  return messages.reduce((sum, msg) => {
    const textLength = msg.parts.reduce((partSum, part) => {
      if ("text" in part) return partSum + part.text.length;
      return partSum;
    }, 0);
    return sum + Math.ceil(textLength / 4);
  }, 0);
}

export async function countTokensExact(
  messages: GeminiMessage[],
  model: GeminiModelId,
  apiKey: string
): Promise<number> {
  const url = `${GEMINI_API_BASE}/models/${model}:countTokens?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: messages }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "countTokens request failed");
  }
  return json.totalTokens ?? 0;
}
