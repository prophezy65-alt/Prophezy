/**
 * lib/chat/memory/memory.service.ts
 *
 * Two memory layers, two jobs:
 *   - lib/ai/memory/session.ts (Redis, 24h TTL): working memory the actual
 *     Gemini call reads/trims from. Owned by AI Core, reused as-is here.
 *   - This module (Postgres, permanent): durable history for session
 *     lists, reload-after-TTL-expiry, analytics, feedback attachment.
 *
 * Every chat turn writes to BOTH — Redis via chat.service.ts (already
 * happens inside sendChatMessage), Postgres via this module (called by
 * orchestrator.service.ts right after). This file never reimplements
 * trimming/summarization; it only persists what context-manager.ts already
 * decided, when it decided to trim (see recordSummaryIfTrimmed below).
 */

import { getOrCreateSession, appendMessage, type SessionRecord } from "../../ai/memory/session";
import { ensureWithinContextWindow, assembleMessages } from "../../ai/memory/context-manager";
import { resolveModelForFeature, MODELS } from "../../ai/config/models";
import * as provider from "../providers/supabase-chat.provider";
import type { ChatModuleId, IntentClassification } from "../types/chat.types";

const CHAT_FEATURE = "chat";

export async function ensureSession(sessionId: string, userId: string): Promise<void> {
  const existing = await provider.getChatSession(sessionId);
  if (!existing) {
    await provider.createChatSession(sessionId, userId);
  }
  // Redis working-memory session, same id — getOrCreateSession is
  // idempotent, safe to call even if a Redis session already exists.
  await getOrCreateSession(sessionId, CHAT_FEATURE, userId);
}

export async function recordUserMessage(sessionId: string, content: string, intent?: IntentClassification): Promise<void> {
  await provider.insertMessage({ sessionId, role: "user", content, intent: intent ?? null });
}

export async function recordAssistantMessage(sessionId: string, content: string, modulesInvoked: ChatModuleId[]): Promise<void> {
  await provider.insertMessage({ sessionId, role: "assistant", content, modulesInvoked });
}

/**
 * Appends a completed turn directly to the Redis working-memory session.
 * ONLY call this for turns that did NOT go through
 * lib/ai/services/chat.service.ts#sendChatMessage (which already appends
 * both sides of the turn itself) — i.e. the module-execution and
 * clarification-question paths in orchestrator.service.ts. Calling this
 * after sendChatMessage would double-append the same turn.
 */
export async function syncTurnToWorkingMemory(sessionId: string, userId: string, userMessage: string, assistantMessage: string): Promise<void> {
  await getOrCreateSession(sessionId, CHAT_FEATURE, userId);
  await appendMessage(sessionId, { role: "user", parts: [{ text: userMessage }] });
  await appendMessage(sessionId, { role: "model", parts: [{ text: assistantMessage }] });
}

/**
 * Fetches the Redis working-memory session, trims it if needed (delegating
 * entirely to context-manager.ts — same call interview.service.ts and
 * chat.service.ts already make), and — only when a trim actually happened —
 * persists the new rolling summary as a row in conversation_summaries so
 * the summary history survives past the Redis 24h TTL.
 */
export async function getContextForTurn(sessionId: string, userId: string): Promise<{ messages: SessionRecord["messages"]; contextText: string }> {
  const session = await getOrCreateSession(sessionId, CHAT_FEATURE, userId);
  const model = resolveModelForFeature(CHAT_FEATURE);
  const trimResult = await ensureWithinContextWindow(session, MODELS[model.id].contextWindow);

  if (trimResult.trimmed) {
    await provider.insertConversationSummary(sessionId, trimResult.rollingSummary, session.messages.length - trimResult.messages.length);
  }

  const finalMessages = assembleMessages({ ...session, messages: trimResult.messages, rollingSummary: trimResult.rollingSummary });

  const contextText = trimResult.rollingSummary
    ? `${trimResult.rollingSummary}\n\nRecent turns: ${summarizeRecentTurns(trimResult.messages)}`
    : summarizeRecentTurns(trimResult.messages);

  return { messages: finalMessages, contextText };
}

function summarizeRecentTurns(messages: SessionRecord["messages"]): string {
  return messages
    .slice(-6) // last few turns is plenty of context for intent detection — it doesn't need the full history context-manager.ts keeps for the actual generation call
    .map((m) => `${m.role}: ${m.parts.map((p) => ("text" in p ? p.text : "[media]")).join(" ")}`)
    .join("\n");
}
