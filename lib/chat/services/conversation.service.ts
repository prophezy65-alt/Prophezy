/**
 * lib/chat/services/conversation.service.ts
 *
 * Session-list and history CRUD the frontend needs beyond sending
 * messages: sidebar list, opening a past conversation, renaming,
 * archiving, submitting feedback on a specific assistant message.
 */

import * as provider from "../providers/supabase-chat.provider";
import { createSessionSchema, renameSessionSchema, submitFeedbackSchema, type CreateSessionInput, type RenameSessionInput, type SubmitFeedbackInput } from "../validation/chat-schemas";
import type { ChatMessage, ChatSession } from "../types/chat.types";
import { randomUUID } from "crypto";

export async function createSession(input: CreateSessionInput): Promise<ChatSession> {
  const parsed = createSessionSchema.parse(input);
  return provider.createChatSession(randomUUID(), parsed.userId, parsed.title);
}

export async function listSessions(userId: string): Promise<ChatSession[]> {
  return provider.listChatSessions(userId);
}

export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  return provider.getSessionMessages(sessionId);
}

export async function renameSession(input: RenameSessionInput): Promise<void> {
  const parsed = renameSessionSchema.parse(input);
  await provider.renameSession(parsed.sessionId, parsed.title);
}

export async function archiveSession(sessionId: string): Promise<void> {
  await provider.archiveSession(sessionId);
}

export async function submitFeedback(input: SubmitFeedbackInput) {
  const parsed = submitFeedbackSchema.parse(input);
  return provider.upsertFeedback(parsed.messageId, parsed.userId, parsed.rating, parsed.comment);
}

/** Auto-titles a session from its first user message — called after the first turn if the session still has the default title. */
export function deriveSessionTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed || "New conversation";
}
