/**
 * lib/chat/context/context.service.ts
 *
 * Session-level orchestration state — NOT conversation history (that's
 * memory.service.ts) and NOT the raw Redis message array (that's
 * lib/ai/memory/session.ts). This is: "is there a multi-step plan
 * mid-execution", "are we waiting on a clarifying answer from the user".
 * Persisted in chat_sessions.metadata so it survives a page reload.
 */

import * as provider from "../providers/supabase-chat.provider";
import type { ChatModuleId, ExecutionPlan } from "../types/chat.types";

export async function getActivePlan(sessionId: string): Promise<ExecutionPlan | null> {
  const session = await provider.getChatSession(sessionId);
  return session?.metadata.activePlan ?? null;
}

export async function setActivePlan(sessionId: string, plan: ExecutionPlan | null): Promise<void> {
  const session = await provider.getChatSession(sessionId);
  const metadata = { ...(session?.metadata ?? {}) };
  if (plan) metadata.activePlan = plan;
  else delete metadata.activePlan;
  await provider.updateSessionMetadata(sessionId, metadata);
}

export async function getPendingClarification(sessionId: string) {
  const session = await provider.getChatSession(sessionId);
  return session?.metadata.pendingClarification ?? null;
}

export async function setPendingClarification(
  sessionId: string,
  clarification: { question: string; forModule: ChatModuleId } | null
): Promise<void> {
  const session = await provider.getChatSession(sessionId);
  const metadata = { ...(session?.metadata ?? {}) };
  if (clarification) metadata.pendingClarification = clarification;
  else delete metadata.pendingClarification;
  await provider.updateSessionMetadata(sessionId, metadata);
}

export async function clearOrchestrationState(sessionId: string): Promise<void> {
  await provider.updateSessionMetadata(sessionId, {});
}
