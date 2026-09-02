/**
 * lib/ai/config/grok-models.ts
 *
 * Model registry for the Grok (xAI) fallback provider. Mirrors the shape of
 * config/models.ts (Gemini) so provider-router.ts / engine.ts can treat
 * "which model did we actually use" uniformly for logging/cost purposes,
 * without touching the Gemini registry.
 *
 * xAI's Chat Completions API is OpenAI-compatible: POST
 * https://api.x.ai/v1/chat/completions. Model slugs get retired/redirected
 * periodically (see https://docs.x.ai for the current catalog) — override
 * via GROK_MODEL_ID if the default below is retired before this file is
 * updated.
 */
export type GrokModelId = string;
export interface GrokModelProfile {
  id: GrokModelId;
  label: string;
  defaultMaxOutputTokens: number;
  defaultTemperature: number;
  /** Cost per 1K tokens in USD — planning estimate, verify at https://x.ai/api before relying on it for billing. */
  costPer1kInputUsd: number;
  costPer1kOutputUsd: number;
}
// Your keys are Groq (gsk_...) keys, so this must be a Groq-hosted model
// slug, not an xAI Grok slug. llama-3.3-70b-versatile was deprecated by
// Groq in June 2026 — openai/gpt-oss-120b is their recommended
// replacement. Override with GROK_MODEL_ID if you want a different Groq
// model (see https://console.groq.com/docs/models).
const FALLBACK_DEFAULT_MODEL_ID = "openai/gpt-oss-120b";
export const DEFAULT_GROK_MODEL: GrokModelId =
  process.env.GROK_MODEL_ID?.trim() || FALLBACK_DEFAULT_MODEL_ID;
export const GROK_MODELS: Record<string, GrokModelProfile> = {
  [DEFAULT_GROK_MODEL]: {
    id: DEFAULT_GROK_MODEL,
    label: "Grok (fallback)",
    defaultMaxOutputTokens: 8192,
    defaultTemperature: 0.7,
    // Placeholder planning estimate — Grok is only used as a fallback path,
    // so exact per-request billing accuracy matters less than not crashing
    // cost estimation when a Grok model id is passed to it. Update from
    // https://x.ai/api pricing if you want this to be invoice-accurate.
    costPer1kInputUsd: 0.003,
    costPer1kOutputUsd: 0.015,
  },
};
/**
 * Same per-feature routing concept as FEATURE_MODEL_MAP in config/models.ts,
 * but every feature currently maps to the same fallback model — Grok is a
 * safety net, not a feature-tuned second primary provider. Add per-feature
 * entries here later if that ever changes.
 */
export function resolveGrokModel(_feature: string): GrokModelProfile {
  // GROK_MODELS is always seeded with an entry keyed by DEFAULT_GROK_MODEL
  // (see the object literal above), so this lookup can never actually be
  // undefined at runtime — the `!` only satisfies TS's indexed-access typing.
  return GROK_MODELS[DEFAULT_GROK_MODEL]!;
}
export function getGrokModelProfile(modelId: string): GrokModelProfile | undefined {
  return GROK_MODELS[modelId];
}
