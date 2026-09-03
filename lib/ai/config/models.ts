/**
 * lib/ai/config/models.ts
 *
 * Central registry of every Gemini model Prophezy is allowed to call, plus
 * per-model defaults (temperature, max tokens, safety thresholds).
 *
 * OpenAI is never used anywhere in this codebase — Gemini only.
 */

export type GeminiModelId =
  | "gemini-3.6-flash"
  | "gemini-3.5-flash-lite"
  | "gemini-3.1-pro-preview";

export interface ModelProfile {
  id: GeminiModelId;
  /** Human label for logs/analytics */
  label: string;
  /** Hard input context window (tokens) */
  contextWindow: number;
  /** Default max output tokens if a prompt template doesn't override it */
  defaultMaxOutputTokens: number;
  /** Default sampling temperature if a prompt template doesn't override it */
  defaultTemperature: number;
  /** Whether this model supports native image/document input */
  supportsMultimodal: boolean;
  /** Cost per 1K tokens in USD, for cost logging (see note below — these
   *  are ESTIMATES, not looked-up-per-request billing). */
  costPer1kInputUsd: number;
  costPer1kOutputUsd: number;
}

/**
 * COST FIELDS — filled in from public Gemini API pricing pages as of
 * ~August 2026 (not looked up live per request; update these by hand when
 * Google changes rates, which it does often this year). Sources
 * disagreed with each other on the exact current Flash/Flash-Lite rate
 * (Google has repriced this generation more than once in 2026) — treat
 * the Flash/Flash-Lite numbers below as a reasonable planning estimate,
 * not an invoice-accurate figure, and verify against
 * https://ai.google.dev/gemini-api/docs/pricing before using them for a
 * real budget. The gemini-3.1-pro-preview number was consistent across
 * every source checked and is high-confidence. None of these model the
 * >200K-token context surcharge (Pro jumps to $4/$18 per 1M above that),
 * cached-input discounts, or Batch API discounts — real spend can be
 * lower (caching, batch) or higher (long documents) than a naive
 * tokens x rate estimate.
 */
export const MODELS: Record<GeminiModelId, ModelProfile> = {
  "gemini-3.6-flash": {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    contextWindow: 1_048_576,
    defaultMaxOutputTokens: 8192,
    defaultTemperature: 0.7,
    supportsMultimodal: true,
    costPer1kInputUsd: 0.00075, // ~$0.75 / 1M input — introductory rate through 2026-12-31, doubles 2027-01-01
    costPer1kOutputUsd: 0.00375, // ~$3.75 / 1M output — same
  },
  "gemini-3.5-flash-lite": {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    contextWindow: 1_048_576,
    defaultMaxOutputTokens: 4096,
    defaultTemperature: 0.6,
    supportsMultimodal: true,
    costPer1kInputUsd: 0.0003, // ~$0.30 / 1M input
    costPer1kOutputUsd: 0.0025, // ~$2.50 / 1M output
  },
  // NOTE: gemini-2.5-pro is dead (404s for new API keys) and there is no GA
  // Gemini 3.x Pro model as of this writing — gemini-3.1-pro-preview is the
  // only Pro-tier model currently reachable. Being a preview model, Google
  // can change/deprecate it with less notice than a GA model; swap this to
  // a GA Gemini 3.x Pro release the moment one ships.
  //
  // This model has a 0-request FREE-TIER allocation on at least one active
  // project in this org (confirmed via a live "Quota exceeded ...
  // limit: 0, model: gemini-3.1-pro" error) — every feature routed to it
  // hard-fails on every call until billing is enabled for that project,
  // regardless of how many API keys/projects key-manager rotates through.
  // No feature is routed here anymore as of this change — see
  // FEATURE_MODEL_MAP below. Left in MODELS since it's still a valid,
  // callable model id if you deliberately want Pro-tier reasoning for a
  // future feature, once billing is enabled.
  "gemini-3.1-pro-preview": {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    contextWindow: 2_097_152,
    defaultMaxOutputTokens: 8192,
    defaultTemperature: 0.65,
    supportsMultimodal: true,
    costPer1kInputUsd: 0.002, // $2.00 / 1M input, up to 200K context — consistent across every source checked
    costPer1kOutputUsd: 0.012, // $12.00 / 1M output, up to 200K context — jumps to $4/$18 above 200K, not modeled here
  },
};

/** Default model used when a prompt template doesn't pin one. */
export const DEFAULT_MODEL: GeminiModelId = "gemini-3.6-flash";

/**
 * Per-feature model routing.
 *
 * FIX (this change): every feature previously routed to
 * gemini-3.1-pro-preview has been moved to gemini-3.6-flash —
 * `research` (done earlier), and now `assignment`, `interview`, `roadmap`
 * too. All four were hitting the identical "Quota exceeded ... limit: 0"
 * hard failure the moment anyone used them; none of them were reachable
 * at all before this change, on the free tier, no matter how many keys
 * key-manager rotated through. This was an explicit request to eliminate
 * every remaining path to that dead-end model — nothing is routed to
 * gemini-3.1-pro-preview anymore.
 *
 * Trade-off, stated plainly: Flash is a materially different model than
 * Pro for genuinely hard reasoning tasks (a multi-step coding assignment
 * rubric, a nuanced interview follow-up, a long-horizon roadmap). This
 * unblocks those three features rather than leaving them permanently
 * broken — if you find output quality on any of them isn't good enough
 * once billing is enabled, moving a specific one back to
 * gemini-3.1-pro-preview is a one-line change, same as this one.
 */
export const FEATURE_MODEL_MAP: Record<string, GeminiModelId> = {
  resume: "gemini-3.6-flash",
  ats: "gemini-3.6-flash",
  research: "gemini-3.6-flash",
  assignment: "gemini-3.6-flash",
  career: "gemini-3.6-flash",
  project: "gemini-3.6-flash",
  interview: "gemini-3.6-flash",
  roadmap: "gemini-3.6-flash",
  notes: "gemini-3.6-flash",
  quiz: "gemini-3.5-flash-lite",
  flashcards: "gemini-3.5-flash-lite",
  mindmap: "gemini-3.6-flash",
  humanizer: "gemini-3.6-flash",
  ocr: "gemini-3.6-flash",
  // Exam Predictor: moved to Flash-Lite for speed, same trade-off already
  // accepted for quiz/flashcards (faster responses, slightly less capable
  // than the default gemini-3.6-flash on strict JSON extraction). If
  // syllabus-extraction accuracy regresses noticeably, "syllabus.extraction"
  // is the one most worth moving back to gemini-3.6-flash first.
  "syllabus.extraction": "gemini-3.5-flash-lite",
  "syllabus.paper-predictor": "gemini-3.5-flash-lite",
  "syllabus.pyq-mapper": "gemini-3.5-flash-lite",
};

export function resolveModelForFeature(feature: string): ModelProfile {
  const id = FEATURE_MODEL_MAP[feature] ?? DEFAULT_MODEL;
  return MODELS[id];
}
