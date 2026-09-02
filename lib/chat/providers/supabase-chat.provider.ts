/**
 * lib/chat/providers/supabase-chat.provider.ts
 *
 * Raw Supabase reads/writes for chat_sessions, chat_messages,
 * conversation_summaries, assistant_feedback. Same
 * `@/lib/supabase/server` import-path assumption as
 * lib/quiz/providers/supabase-quiz.provider.ts — see that file's header
 * comment for the exact caveat, not repeated here.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type {
  AssistantFeedback,
  AssistantFeedbackRating,
  ChatMessage,
  ChatModuleId,
  ChatSession,
  ChatSessionMetadata,
  ConversationSummary,
  IntentClassification,
} from "../types/chat.types";

async function db() {
  return createServerClient();
}

// ---- sessions -------------------------------------------------------

export async function createChatSession(id: string, userId: string, title = "New conversation"): Promise<ChatSession> {
  const supabase = await db();
  const { data, error } = await supabase.from("chat_sessions").insert({ id, user_id: userId, title }).select().single();
  if (error) throw error;
  return mapSessionRow(data);
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("chat_sessions").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapSessionRow(data) : null;
}

export async function listChatSessions(userId: string, limit = 50): Promise<ChatSession[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select()
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapSessionRow);
}

export async function updateSessionMetadata(id: string, metadata: ChatSessionMetadata): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ metadata: metadata as unknown as Json, last_message_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function renameSession(id: string, title: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("chat_sessions").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function archiveSession(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("chat_sessions").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
}

// ---- messages -------------------------------------------------------

export async function insertMessage(row: {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modulesInvoked?: ChatModuleId[] | null;
  intent?: IntentClassification | null;
}): Promise<ChatMessage> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: row.sessionId,
      role: row.role,
      content: row.content,
      modules_invoked: row.modulesInvoked ?? null,
      intent: (row.intent ?? null) as unknown as Json,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from("chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", row.sessionId);

  return mapMessageRow(data);
}

export async function getSessionMessages(sessionId: string, limit = 100): Promise<ChatMessage[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("chat_messages")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapMessageRow);
}

// ---- summaries --------------------------------------------------------

export async function insertConversationSummary(sessionId: string, summaryText: string, messageCountCovered: number): Promise<ConversationSummary> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("conversation_summaries")
    .insert({ session_id: sessionId, summary_text: summaryText, message_count_covered: messageCountCovered })
    .select()
    .single();
  if (error) throw error;
  return mapSummaryRow(data);
}

export async function getLatestSummary(sessionId: string): Promise<ConversationSummary | null> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("conversation_summaries")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSummaryRow(data) : null;
}

// ---- feedback -----------------------------------------------------------

export async function upsertFeedback(messageId: string, userId: string, rating: AssistantFeedbackRating, comment?: string): Promise<AssistantFeedback> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("assistant_feedback")
    .upsert({ message_id: messageId, user_id: userId, rating, comment: comment ?? null }, { onConflict: "message_id,user_id" })
    .select()
    .single();
  if (error) throw error;
  return mapFeedbackRow(data);
}

// ---- row mappers --------------------------------------------------------

function mapSessionRow(row: any): ChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    lastMessageAt: row.last_message_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row: any): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    modulesInvoked: row.modules_invoked,
    intent: row.intent,
    createdAt: row.created_at,
  };
}

function mapSummaryRow(row: any): ConversationSummary {
  return {
    id: row.id,
    sessionId: row.session_id,
    summaryText: row.summary_text,
    messageCountCovered: row.message_count_covered,
    createdAt: row.created_at,
  };
}

function mapFeedbackRow(row: any): AssistantFeedback {
  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}
