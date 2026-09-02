/**
 * lib/research/services/chat.service.ts
 *
 * "Chat with documents" = RAG over the user's uploaded papers. Built as a
 * thin wrapper around lib/ai/services/chat.service.ts's sendChatMessage
 * (per that file's own documented extension pattern — see its header
 * comment), with retrieval via lib/document's searchService and durable
 * history via chat_sessions/chat_messages (0030) rather than the 24h-TTL
 * Redis session alone.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { sendChatMessage } from "@/lib/ai/services/chat.service";
import type { StreamChunk } from "@/lib/ai/config/client";
import { wrapUserContent } from "@/lib/ai/middleware/safety";
import { searchService } from "@/lib/document";
import type { SearchResult } from "@/lib/document/models/analysis.model";
import { getPaper } from "./paper.service";
import { ResearchError } from "../utils/errors";
import { researchLogger } from "../utils/logger";
import { spendCredits, refundCredits, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";

export class ResearchChatError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "RESEARCH_CHAT_ERROR", cause);
  }
}

const RESEARCH_CHAT_FEATURE = "research";
const RAG_RESULT_LIMIT = 6;

export interface ChatSessionRow {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  last_message_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modules_invoked: string[] | null;
  intent: Record<string, unknown> | null;
  created_at: string;
}

const RESEARCH_SYSTEM_PROMPT_BASE =
  "You are a research assistant helping a student understand academic papers " +
  "they've uploaded. Answer using only the source passages provided below — " +
  "if the answer isn't in them, say so plainly rather than guessing from " +
  "general knowledge. When you use a passage, briefly note which paper it " +
  "came from. Be precise and concise; this is a study tool, not a chatbot " +
  "that pads answers.";

/** Fetches an existing session (ownership-checked) or creates a new one. */
export async function getOrCreateResearchSession(
  userId: string,
  opts: { sessionId?: string; paperId?: string } = {}
): Promise<ChatSessionRow> {
  const supabase = await createClient();

  if (opts.sessionId) {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select()
      .eq("id", opts.sessionId)
      .eq("user_id", userId)
      .maybeSingle<ChatSessionRow>();

    if (error) throw new ResearchChatError("Failed to load chat session.", error.message);
    if (!data) throw new ResearchChatError(`Chat session ${opts.sessionId} not found.`);
    return data;
  }

  let title = "Research chat";
  if (opts.paperId) {
    const paper = await getPaper(userId, opts.paperId);
    title = `Chat: ${paper.title}`.slice(0, 200);
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      id: randomUUID(),
      user_id: userId,
      title,
      metadata: { feature: "research", paperId: opts.paperId ?? null },
    })
    .select()
    .single<ChatSessionRow>();

  if (error || !data) throw new ResearchChatError("Failed to create chat session.", error?.message);
  return data;
}

export async function listResearchSessions(userId: string): Promise<ChatSessionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select()
    .eq("user_id", userId)
    .contains("metadata", { feature: "research" })
    .order("last_message_at", { ascending: false })
    .returns<ChatSessionRow[]>();

  if (error) throw new ResearchChatError("Failed to list chat sessions.", error.message);
  return data ?? [];
}

export async function listSessionMessages(userId: string, sessionId: string): Promise<ChatMessageRow[]> {
  await getOrCreateResearchSession(userId, { sessionId }); // ownership check
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<ChatMessageRow[]>();

  if (error) throw new ResearchChatError("Failed to load chat history.", error.message);
  return data ?? [];
}

function buildGroundedSystemPrompt(results: SearchResult[]): string {
  if (results.length === 0) {
    return (
      RESEARCH_SYSTEM_PROMPT_BASE +
      " No matching passages were found in the user's papers for this question — say so and suggest they " +
      "rephrase or upload the relevant paper, rather than answering from general knowledge."
    );
  }

  const passages = results
    .map((r, i) => `[Source ${i + 1} — document ${r.documentId}, page ${r.pageIndex ?? "?"}]\n${r.snippet}`)
    .join("\n\n");

  return `${RESEARCH_SYSTEM_PROMPT_BASE}\n\n${wrapUserContent("retrieved_passages", passages)}`;
}

export interface StreamResearchChatParams {
  userId: string;
  sessionId: string;
  paperId?: string; // scope retrieval to one paper; omit to search across all the user's papers
  message: string;
}

export interface StreamResearchChatHandle {
  sources: SearchResult[];
  stream: AsyncGenerator<StreamChunk, void, unknown>;
}

/**
 * Retrieves relevant passages, then returns both the retrieved sources
 * (for the caller to surface as citations before streaming starts — e.g.
 * as a response header) and the token stream itself. Both turns are
 * persisted to chat_messages once the stream completes.
 */
export async function streamResearchChat(params: StreamResearchChatParams): Promise<StreamResearchChatHandle> {
  const { userId, sessionId, paperId, message } = params;
  if (!message.trim()) throw new ResearchChatError("Message cannot be empty.");

  await getOrCreateResearchSession(userId, { sessionId }); // ownership check — throws if not found/not owned

  let documentId: string | undefined;
  if (paperId) {
    const paper = await getPaper(userId, paperId);
    if (!paper.document_id) {
      throw new ResearchChatError("This paper has no uploaded document to chat with — save it with an upload first.");
    }
    documentId = paper.document_id;
  }

  const sources = await searchService.search({
    userId,
    documentId,
    query: message,
    mode: "hybrid",
    limit: RAG_RESULT_LIMIT,
  });

  const systemInstruction = buildGroundedSystemPrompt(sources);
  const supabase = await createClient();

  const { error: userInsertError } = await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: message,
    modules_invoked: ["research_ai"],
  });
  if (userInsertError) throw new ResearchChatError("Failed to save your message.", userInsertError.message);

  researchLogger.info("chat.turn_started", { userId, sessionId, paperId, sourceCount: sources.length });

  // CREDIT GATING (fixed — this was an unwired real Gemini call): each
  // research-chat turn is a genuine RESEARCH_PAPER_AI_QUERY, spent EAGERLY
  // right here — before streamAndPersist() is even constructed, before
  // this function returns — so an insufficient-balance failure surfaces
  // as a plain thrown InsufficientCreditsError from streamResearchChat()
  // itself, same as every other setup failure above (ResearchChatError).
  // RESEARCH_CHAT_FEATURE (below, in sendChatMessage's `feature` param) is
  // a SEPARATE concern — it drives Gemini MODEL ROUTING, not credit cost —
  // so it's left untouched; CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY is
  // used only for the credit charge itself.
  const creditFeature = CREDIT_FEATURES.RESEARCH_PAPER_AI_QUERY;
  const creditCost = await getFeatureCreditCost(creditFeature);
  if (!creditCost) {
    throw new ResearchChatError(
      `Research Paper AI chat is temporarily unavailable (no active credit cost configured for "${creditFeature}").`
    );
  }
  const creditCostAmount = creditCost.creditCost;
  await spendCredits(creditCostAmount, creditFeature, "Research paper chat query");

  async function* streamAndPersist(): AsyncGenerator<StreamChunk, void, unknown> {
    let accumulated = "";
    try {
      for await (const chunk of sendChatMessage({
        sessionId,
        userId,
        feature: RESEARCH_CHAT_FEATURE,
        systemInstruction,
        userMessage: message,
      })) {
        accumulated = chunk.accumulated;
        yield chunk;
      }
    } catch (err) {
      // Stream failed after the charge was already taken — refund, then
      // let the original error propagate to the caller unchanged.
      await refundCredits(userId, creditCostAmount, creditFeature, "Refund: research chat stream failed").catch(() => {});
      throw err;
    } finally {
      if (accumulated) {
        await supabase
          .from("chat_messages")
          .insert({ session_id: sessionId, role: "assistant", content: accumulated, modules_invoked: ["research_ai"] });
        await supabase.from("chat_sessions").update({ last_message_at: new Date().toISOString() }).eq("id", sessionId);
        researchLogger.info("chat.turn_completed", { userId, sessionId, responseLength: accumulated.length });
      }
    }
  }

  return { sources, stream: streamAndPersist() };
}
