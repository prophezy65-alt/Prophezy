/**
 * lib/ai/memory/context-manager.ts
 *
 * Keeps a session's message history under a model's context window by
 * trimming old turns and folding them into the session's rolling summary
 * (via a cheap summarization call) instead of just dropping them silently.
 */

import type { GeminiMessage } from "../config/client";
import { generateWithFallback } from "../config/provider-router";
import { estimateMessagesTokens } from "../utils/tokens";
import { setRollingSummary, type SessionRecord } from "./session";
import { logger } from "../utils/logger";

const OUTPUT_RESERVE_TOKENS = 4096;
const SYSTEM_PROMPT_RESERVE_TOKENS = 1000;

export interface TrimResult {
  messages: GeminiMessage[];
  rollingSummary: string;
  trimmed: boolean;
}

/**
 * If the session's message history is within budget, returns it unchanged.
 * Otherwise, summarizes the oldest half of the conversation into the
 * rolling summary and keeps only the most recent turns verbatim.
 */
export async function ensureWithinContextWindow(
  session: SessionRecord,
  contextWindowTokens: number
): Promise<TrimResult> {
  const budget = contextWindowTokens - OUTPUT_RESERVE_TOKENS - SYSTEM_PROMPT_RESERVE_TOKENS;
  const currentTokens = estimateMessagesTokens(session.messages);

  if (currentTokens <= budget) {
    return { messages: session.messages, rollingSummary: session.rollingSummary, trimmed: false };
  }

  const splitPoint = Math.floor(session.messages.length / 2);
  const toSummarize = session.messages.slice(0, splitPoint);
  const toKeep = session.messages.slice(splitPoint);

  const summaryPrompt = buildSummaryPrompt(session.rollingSummary, toSummarize);
  // generateWithFallback() instead of a direct generate() call — this
  // summarization call bypassed engine.ts (and therefore the Gemini->Grok
  // fallback) before. Swapped for the same reason as the OCR/PDF call sites.
  const summaryResult = await generateWithFallback(
    [{ role: "user", parts: [{ text: summaryPrompt }] }],
    { model: "gemini-2.5-flash-lite", temperature: 0.2, maxOutputTokens: 512, feature: "context-summary" }
  );

  const newSummary = summaryResult.text.trim();
  await setRollingSummary(session.sessionId, newSummary);

  logger.info("ai.context.trimmed", {
    sessionId: session.sessionId,
    droppedTurns: toSummarize.length,
    keptTurns: toKeep.length,
  });

  return { messages: toKeep, rollingSummary: newSummary, trimmed: true };
}

function buildSummaryPrompt(existingSummary: string, messages: GeminiMessage[]): string {
  const transcript = messages
    .map(
      (m) =>
        `${m.role.toUpperCase()}: ${m.parts
          .map((p) => ("text" in p ? p.text : "[media]"))
          .join(" ")}`
    )
    .join("\n");

  return [
    existingSummary
      ? `Existing conversation summary so far:\n${existingSummary}`
      : "There is no prior summary yet.",
    "New turns to fold into the summary:",
    transcript,
    "Write an updated, concise summary (under 200 words) capturing the key " +
      "facts, decisions, and context a continuing conversation would need — " +
      "not a turn-by-turn recap.",
  ].join("\n\n");
}

/**
 * Builds the final message array to send to Gemini for a turn: the rolling
 * summary (if any) injected as a leading context message, followed by the
 * verbatim recent history.
 */
export function assembleMessages(session: SessionRecord): GeminiMessage[] {
  if (!session.rollingSummary) return session.messages;

  const summaryMessage: GeminiMessage = {
    role: "user",
    parts: [{ text: `[Conversation summary so far]: ${session.rollingSummary}` }],
  };

  return [summaryMessage, ...session.messages];
}
