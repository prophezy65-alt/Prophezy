// lib/humanizer/services/analytics.service.ts
//
// Persists to the new `humanizer_analytics` table (see migrations/ — this is
// a NEW table this module introduces, not a modification of the existing
// DO-NOT-MODIFY schema). Assumes the project's existing Supabase admin
// client helper; adjust the import path below to match your actual
// lib/supabase/ location if it differs.

import { createAdminClient as getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { HumanizerAnalyticsEvent, UsageAnalyticsSummary, RewriteStyle } from "../models/types";
import { logger } from "./_logger";

export async function logHumanizerEvent(event: HumanizerAnalyticsEvent): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("humanizer_analytics").insert({
      user_id: event.userId,
      rewrite_id: event.rewriteId,
      event_type: event.eventType,
      metadata: event.metadata,
      created_at: event.timestamp,
    });
    if (error) throw error;
  } catch (err) {
    // Analytics must never break the primary rewrite flow.
    logger.warn("humanizer.analytics.persist_failed", { error: String(err), eventType: event.eventType });
  }
}

export async function getUsageSummary(userId: string): Promise<UsageAnalyticsSummary> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("humanizer_history")
    .select("style, readability_before, readability_after, grammar_score_before, grammar_score_after")
    .eq("user_id", userId);

  if (error || !data || data.length === 0) {
    return { userId, totalRewrites: 0, favoriteStyle: null, averageReadabilityImprovement: 0, averageGrammarScoreImprovement: 0 };
  }

  const styleCounts = new Map<RewriteStyle, number>();
  let readabilityDeltaSum = 0;
  let grammarDeltaSum = 0;

  for (const row of data as HistoryAnalyticsRow[]) {
    styleCounts.set(row.style, (styleCounts.get(row.style) ?? 0) + 1);
    readabilityDeltaSum += (row.readability_after ?? 0) - (row.readability_before ?? 0);
    grammarDeltaSum += (row.grammar_score_after ?? 0) - (row.grammar_score_before ?? 0);
  }

  const favoriteStyle =
    Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    userId,
    totalRewrites: data.length,
    favoriteStyle,
    averageReadabilityImprovement: round2(readabilityDeltaSum / data.length),
    averageGrammarScoreImprovement: round2(grammarDeltaSum / data.length),
  };
}

interface HistoryAnalyticsRow {
  style: RewriteStyle;
  readability_before: number | null;
  readability_after: number | null;
  grammar_score_before: number | null;
  grammar_score_after: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
