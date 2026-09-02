/**
 * lib/ai/middleware/analytics.ts
 *
 * Records every AI call's cost/latency/outcome. Ships to console via the
 * logger by default; swap `persist()` for a Supabase insert once the
 * `ai_usage_events` table exists (owned by the DB branch, not this layer —
 * this module only assumes a table name + columns, it never issues DDL).
 */

import { logger } from "../utils/logger";
import { MODELS } from "../config/models";
import { GROK_MODELS } from "../config/grok-models";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UsageEvent {
  requestId: string;
  userId?: string;
  feature: string;
  // Widened from GeminiModelId -> string: unchanged for every existing
  // Gemini call site (Gemini model ids are still valid strings), and now
  // also accepts a Grok model id on the rare call that was served by the
  // Gemini -> Grok fallback (see config/provider-router.ts).
  model: string;
  // Optional and defaulted below so every pre-existing call site (which
  // never set this) keeps behaving exactly as before — "gemini" was always
  // the implicit provider prior to this field existing.
  provider?: "gemini" | "grok";
  promptTokens: number;
  outputTokens: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  cacheHit?: boolean;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  outputTokens: number
): number {
  const profile = MODELS[model as keyof typeof MODELS] ?? GROK_MODELS[model];
  if (!profile) {
    logger.debug("ai.analytics.unknown_model_cost", { model });
    return 0;
  }
  const inputCost = (promptTokens / 1000) * profile.costPer1kInputUsd;
  const outputCost = (outputTokens / 1000) * profile.costPer1kOutputUsd;
  return Number((inputCost + outputCost).toFixed(6));
}

/**
 * Fire-and-forget usage tracker. Never throws and never blocks the request
 * path — analytics failures must not fail an AI feature.
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  const costUsd = estimateCostUsd(event.model, event.promptTokens, event.outputTokens);

  logger.info("ai.usage", { ...event, costUsd });

  try {
    await persist({ ...event, costUsd });
  } catch (err) {
    logger.warn("ai.usage.persist_failed", {
      requestId: event.requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Persists a usage event to public.ai_usage_events (0036_ai_usage_events.sql).
 * Uses the service-role client since this fires from deep inside the AI
 * engine with no per-request cookie context guaranteed, and the row's
 * user_id comes from the already-authenticated caller (RunAIParams.userId),
 * not from anything end-user-suppliable at this layer.
 */
async function persist(event: UsageEvent & { costUsd: number }): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_usage_events").insert({
    request_id: event.requestId,
    user_id: event.userId && event.userId !== "anonymous" ? event.userId : null,
    feature: event.feature,
    model: event.model,
    prompt_tokens: event.promptTokens,
    output_tokens: event.outputTokens,
    duration_ms: event.durationMs,
    success: event.success,
    error_message: event.errorMessage ?? null,
    cache_hit: event.cacheHit ?? false,
    cost_usd: event.costUsd,
  });
  if (error) throw new Error(error.message);
}
