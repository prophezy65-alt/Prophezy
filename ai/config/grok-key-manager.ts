/**
 * lib/ai/config/grok-key-manager.ts
 *
 * Manages a pool of Grok (xAI) API keys for config/grok-client.ts. This is
 * the Grok-side counterpart to config/key-manager.ts (Gemini) — same
 * pattern (numbered env vars, cooldown-on-failure, last-known-good caching)
 * deliberately duplicated rather than shared, so that touching Grok
 * behavior can NEVER regress Gemini's key rotation/cooldown logic.
 * key-manager.ts (Gemini) is not imported or modified by this file.
 *
 * Reads GROK_API_KEY_1, GROK_API_KEY_2, ... (falls back to a single
 * GROK_API_KEY for simple single-key deployments).
 *
 * State is in-memory (module-level) — same "correct within one warm
 * process" trade-off as the Gemini key manager, for the same reasons.
 * Keys are never logged in full or in part — only a 1-based index like
 * "grok key #2".
 */

import { AIConfigError, AIRequestError, AITimeoutError } from "../utils/errors";
import { logger } from "../utils/logger";

const KEY_PREFIX = "GROK_API_KEY_";
const SINGLE_KEY_VAR = "GROK_API_KEY";
const DISABLED_KEYS_VAR = "GROK_API_KEY_DISABLED";

const QUOTA_COOLDOWN_MS = 60_000; // 429 — per-minute limits typically reset within a minute
const INVALID_KEY_COOLDOWN_MS = 10 * 60_000; // 401/403 — unlikely to self-heal soon
const SERVER_ERROR_COOLDOWN_MS = 30_000; // 5xx — usually transient upstream

export class GrokAllKeysExhaustedError extends Error {
  constructor(keyCount: number) {
    super(
      `All ${keyCount} configured Grok API key(s) are currently rate-limited or unavailable.`
    );
    this.name = "GrokAllKeysExhaustedError";
  }
}

export type GrokKeyFailureKind = "quota" | "invalid" | "server" | "transient";

interface GrokKeyState {
  index: number;
  key: string;
  cooldownUntil: number;
  lastFailureReason?: GrokKeyFailureKind;
}

let keyPool: GrokKeyState[] | null = null;
let preferredIndex = 0;

function loadKeyPool(): GrokKeyState[] {
  if (keyPool) return keyPool;

  const disabledVarNames = new Set(
    (process.env[DISABLED_KEYS_VAR] ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );

  const numbered = Object.keys(process.env)
    .filter((k) => k.startsWith(KEY_PREFIX) && k !== DISABLED_KEYS_VAR && process.env[k])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const includedNumbered = numbered.filter((k) => {
    if (disabledVarNames.has(k)) {
      logger.warn("ai.grok_key_manager.key_disabled_by_config", { key: k });
      return false;
    }
    return true;
  });

  const keys = includedNumbered.map((k) => process.env[k] as string);

  const single = process.env[SINGLE_KEY_VAR];
  if (single && disabledVarNames.has(SINGLE_KEY_VAR)) {
    logger.warn("ai.grok_key_manager.key_disabled_by_config", { key: SINGLE_KEY_VAR });
  } else if (single && !keys.includes(single)) {
    keys.push(single);
  }

  keyPool = keys.map((key, index) => ({ index, key, cooldownUntil: 0 }));

  logger.info("ai.grok_key_manager.loaded", {
    keyCount: keyPool.length,
    disabledCount: disabledVarNames.size,
  });

  return keyPool;
}

/** For tests only: force the pool to reload from process.env on next access. */
export function __resetGrokKeyPoolForTests(): void {
  keyPool = null;
  preferredIndex = 0;
}

function label(index: number): string {
  return `grok key #${index + 1}`;
}

export function classifyGrokFailure(err: unknown): GrokKeyFailureKind {
  if (err instanceof AITimeoutError) return "transient";

  if (err instanceof AIRequestError) {
    const status = err.status;
    const message = (err.message || "").toLowerCase();

    if (status === 429 || message.includes("quota") || message.includes("rate limit")) {
      return "quota";
    }
    if (status === 401 || status === 403) return "invalid";
    if (status && status >= 500) return "server";
  }

  return "transient";
}

function cooldownFor(kind: GrokKeyFailureKind): number {
  switch (kind) {
    case "quota":
      return QUOTA_COOLDOWN_MS;
    case "invalid":
      return INVALID_KEY_COOLDOWN_MS;
    case "server":
      return SERVER_ERROR_COOLDOWN_MS;
    default:
      return 0;
  }
}

export function reportGrokKeyFailure(index: number, err: unknown): GrokKeyFailureKind {
  const pool = loadKeyPool();
  const state = pool[index];
  const kind = classifyGrokFailure(err);
  if (!state) return kind;

  const cooldown = cooldownFor(kind);
  if (cooldown > 0) {
    state.cooldownUntil = Date.now() + cooldown;
    state.lastFailureReason = kind;
    logger.warn("ai.grok_key_manager.key_cooldown", { key: label(index), reason: kind, cooldownMs: cooldown });
  } else {
    logger.warn("ai.grok_key_manager.transient_failure", { key: label(index), reason: kind });
  }
  return kind;
}

export function reportGrokKeySuccess(index: number): void {
  preferredIndex = index;
  const pool = loadKeyPool();
  if (pool[index]) pool[index].cooldownUntil = 0;
  logger.info("ai.grok_key_manager.key_used", { key: label(index) });
}

export function getGrokKeyOrder(): GrokKeyState[] {
  const pool = loadKeyPool();
  if (pool.length === 0) return [];

  const now = Date.now();
  const available = pool.filter((k) => k.cooldownUntil <= now);
  const cooling = pool.filter((k) => k.cooldownUntil > now).sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  const ordered = [...available, ...cooling];

  const preferred = ordered.find((k) => k.index === preferredIndex);
  return preferred ? [preferred, ...ordered.filter((k) => k.index !== preferredIndex)] : ordered;
}

export function grokKeyCount(): number {
  return loadKeyPool().length;
}

export type GrokKeyHealthStatus = "healthy" | "cooling_down";

export interface GrokKeyHealth {
  label: string;
  status: GrokKeyHealthStatus;
  cooldownRemainingMs: number;
  lastFailureReason: GrokKeyFailureKind | null;
  isPreferred: boolean;
}

/** Read-only snapshot for Settings > AI Control Center, mirroring getKeySnapshot() for Gemini. */
export function getGrokKeySnapshot(): GrokKeyHealth[] {
  const pool = loadKeyPool();
  const now = Date.now();
  return pool.map((state) => ({
    label: label(state.index),
    status: state.cooldownUntil > now ? "cooling_down" : "healthy",
    cooldownRemainingMs: state.cooldownUntil > now ? state.cooldownUntil - now : 0,
    lastFailureReason: state.lastFailureReason ?? null,
    isPreferred: state.index === preferredIndex,
  }));
}

/** True if at least one Grok key is configured — used by provider-router to decide whether
 *  falling back to Grok is even possible before attempting it. */
export function grokConfigured(): boolean {
  return grokKeyCount() > 0;
}

export function assertGrokKeysConfigured(): void {
  if (grokKeyCount() === 0) {
    throw new AIConfigError(
      "No Grok API key is configured. Set GROK_API_KEY_1 (and optionally _2, _3, ...) or GROK_API_KEY."
    );
  }
}
