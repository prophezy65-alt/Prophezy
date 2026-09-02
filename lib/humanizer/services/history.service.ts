// lib/humanizer/services/history.service.ts
import { randomUUID } from "crypto";
import { createAdminClient as getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Rewrite, RewriteHistoryEntry } from "../models/types";
import { logger } from "./_logger";

const PREVIEW_LENGTH = 200;

export async function saveRewriteToHistory(rewrite: Rewrite): Promise<RewriteHistoryEntry> {
  const entry: RewriteHistoryEntry = {
    id: randomUUID(),
    userId: rewrite.userId,
    rewriteId: rewrite.id,
    originalPreview: rewrite.originalText.slice(0, PREVIEW_LENGTH),
    rewrittenPreview: rewrite.rewrittenText.slice(0, PREVIEW_LENGTH),
    style: rewrite.options.style,
    tone: rewrite.options.tone,
    domain: rewrite.options.domain,
    createdAt: rewrite.createdAt,
  };

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("humanizer_history").insert({
    id: entry.id,
    user_id: rewrite.userId,
    rewrite_id: rewrite.id,
    original_text: rewrite.originalText,
    rewritten_text: rewrite.rewrittenText,
    style: rewrite.options.style,
    tone: rewrite.options.tone,
    domain: rewrite.options.domain,
    grammar_score_before: null, // set by caller if a pre-rewrite grammar check was run
    grammar_score_after: rewrite.grammar.score,
    readability_before: null,
    readability_after: rewrite.readability.fleschReadingEase,
    changes_summary: rewrite.changesSummary,
    created_at: rewrite.createdAt,
  });

  if (error) {
    logger.error("humanizer.history.save_failed", { error: String(error), rewriteId: rewrite.id });
    throw new Error(`Failed to save rewrite history: ${error.message}`);
  }

  return entry;
}

export async function getHistoryForUser(userId: string, limit = 50, offset = 0): Promise<RewriteHistoryEntry[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("humanizer_history")
    .select("id, user_id, rewrite_id, original_text, rewritten_text, style, tone, domain, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("humanizer.history.fetch_failed", { error: String(error), userId });
    throw new Error(`Failed to fetch history: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    rewriteId: row.rewrite_id,
    originalPreview: (row.original_text as string).slice(0, PREVIEW_LENGTH),
    rewrittenPreview: (row.rewritten_text as string).slice(0, PREVIEW_LENGTH),
    style: row.style,
    tone: row.tone,
    domain: row.domain,
    createdAt: row.created_at,
  })) as RewriteHistoryEntry[];
}

export async function deleteHistoryEntry(userId: string, historyId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("humanizer_history").delete().eq("id", historyId).eq("user_id", userId);
  if (error) {
    logger.error("humanizer.history.delete_failed", { error: String(error), historyId });
    throw new Error(`Failed to delete history entry: ${error.message}`);
  }
}
