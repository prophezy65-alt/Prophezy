/**
 * lib/ai/config/key-manager.ts
 *
 * Manages a pool of Gemini API keys for config/client.ts. Reads every
 * GEMINI_API_KEY_* environment variable (falls back to a single
 * GEMINI_API_KEY for backward compatibility with existing deployments),
 * classifies failures so only quota/rate-limit/invalid-key/blocked/
 * server-error responses trigger rotation, applies a per-key cooldown so a
 * bad key isn't retried on every single request, and caches the
 * last-known-good key index so future requests start there instead of
 * always at key #0.
 *
 * This is deliberately separate from utils/retry.ts, not a replacement for
 * it: retry.ts handles "try the SAME key again after a backoff" for
 * transient blips; this handles "give up on THIS key and try a different
 * one" for key-specific exhaustion. config/client.ts composes both.
 *
 * State is in-memory (module-level) — correct within one warm server
 * process. On serverless platforms with many cold-started instances, each
 * instance builds its own view of key health independently; that's an
 * accepted trade-off here rather than adding a shared store (Redis) for a
 * problem that self-heals within one cooldown window regardless.
 *
 * Keys are never logged in full or in part — only a 1-based index like
 * "key #2".
 *
 * OPERATOR-CONTROLLED EXCLUSION: some 403s are not a transient/self-healing
 * problem — e.g. Google returning "Your project has been denied access.
 * Please contact support." for a specific project. That doesn't resolve
 * itself in 10 minutes, so hammering it every 10 minutes forever wastes a
 * retry slot on every request for no benefit. Two mechanisms handle this,
 * without ever requiring the variable to be deleted from .env:
 *   1. GEMINI_API_KEY_DISABLED — a comma-separated list of variable NAMES
 *      (e.g. "GEMINI_API_KEY_5,GEMINI_API_KEY_18") to exclude from the pool
 *      entirely at load time. Use this once you've confirmed via the
 *      diagnostic script that a specific credential is blocked/revoked —
 *      it's the deterministic, explicit way to keep a known-bad key out of
 *      rotation while leaving the .env entry in place for later reference.
 *   2. Automatic "blocked" classification (see classifyFailure below) — for
 *      any key that starts returning this same denied-access pattern in
 *      production without yet being added to GEMINI_API_KEY_DISABLED, it
 *      gets a much longer cooldown than a generic invalid-key failure
 *      instead of being retried every 10 minutes.
 */

import { AIConfigError, AIRequestError, AITimeoutError } from "../utils/errors";
import { logger } from "../utils/logger";

const KEY_PREFIX = "GEMINI_API_KEY_";
const SINGLE_KEY_VAR = "GEMINI_API_KEY";
const DISABLED_KEYS_VAR = "GEMINI_API_KEY_DISABLED";

const QUOTA_COOLDOWN_MS = 60_000; // 429 — per-minute limits typically reset within a minute
const INVALID_KEY_COOLDOWN_MS = 10 * 60_000; // 400/403 — unlikely to self-heal soon, don't hammer it
const BLOCKED_COOLDOWN_MS = 24 * 60 * 60_000; // 403 project-denied — an account/project-level state that won't clear on its own; don't hammer it every 10 minutes for a full day
const SERVER_ERROR_COOLDOWN_MS = 30_000; // 5xx — usually a transient upstream issue

export class AIAllKeysExhaustedError extends Error {
  constructor(keyCount: number) {
    super(
      `All ${keyCount} configured Gemini API key(s) are currently rate-limited or unavailable. ` +
        "Please try again shortly."
    );
    this.name = "AIAllKeysExhaustedError";
  }
}

export type KeyFailureKind = "quota" | "invalid" | "blocked" | "server" | "transient";

interface KeyState {
  index: number;
  key: string;
  cooldownUntil: number; // epoch ms; 0 = not in cooldown
  lastFailureReason?: KeyFailureKind;
}

let keyPool: KeyState[] | null = null;
let preferredIndex = 0;

function loadKeyPool(): KeyState[] {
  if (keyPool) return keyPool;

  const disabledVarNames = new Set(
    (process.env[DISABLED_KEYS_VAR] ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  );

  const numbered = Object.keys(process.env)
    // k !== DISABLED_KEYS_VAR matters: GEMINI_API_KEY_DISABLED shares the
    // same KEY_PREFIX ("GEMINI_API_KEY_") as the real numbered keys, so
    // without this exclusion the control variable's own value (a
    // comma-separated list of names, not a credential) would be swept
    // into the pool as a bogus extra "key".
    .filter((k) => k.startsWith(KEY_PREFIX) && k !== DISABLED_KEYS_VAR && process.env[k])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const includedNumbered = numbered.filter((k) => {
    if (disabledVarNames.has(k)) {
      logger.warn("ai.key_manager.key_disabled_by_config", { key: k });
      return false;
    }
    return true;
  });

  const keys = includedNumbered.map((k) => process.env[k] as string);

  // The bare GEMINI_API_KEY was previously used ONLY as a fallback when
  // zero numbered keys existed (either/or). That silently dropped a bare
  // GEMINI_API_KEY from the pool entirely whenever GEMINI_API_KEY_2+ were
  // also configured — a real, distinct credential that never even appeared
  // in key-count logs, let alone got tested. It's now always included
  // (subject to the same GEMINI_API_KEY_DISABLED check): appended last
  // (lowest priority — same relative position it would occupy if renamed
  // to the next unused numbered slot) and de-duplicated in case it's just
  // a copy of a value already present.
  const single = process.env[SINGLE_KEY_VAR];
  if (single && disabledVarNames.has(SINGLE_KEY_VAR)) {
    logger.warn("ai.key_manager.key_disabled_by_config", { key: SINGLE_KEY_VAR });
  } else if (single && !keys.includes(single)) {
    keys.push(single);
  }

  keyPool = keys.map((key, index) => ({ index, key, cooldownUntil: 0 }));

  logger.info("ai.key_manager.loaded", {
    keyCount: keyPool.length,
    disabledCount: disabledVarNames.size,
  });

  return keyPool;
}

/** For tests only: force the pool to reload from process.env on next access. */
export function __resetKeyPoolForTests(): void {
  keyPool = null;
  preferredIndex = 0;
}

function label(index: number): string {
  return `key #${index + 1}`;
}

export function classifyFailure(err: unknown): KeyFailureKind {
  if (err instanceof AITimeoutError) return "transient";

  if (err instanceof AIRequestError) {
    const status = err.status;
    const message = (err.message || "").toLowerCase();

    if (status === 429 || message.includes("quota") || message.includes("resource_exhausted")) {
      return "quota";
    }
    if (
      status === 403 &&
      (message.includes("denied access") ||
        message.includes("permission_denied") ||
        message.includes("has been denied"))
    ) {
      // Google-side project/account-level block — e.g. "Your project has
      // been denied access. Please contact support." Distinct from a
      // plain invalid/expired key: this doesn't self-heal within a normal
      // cooldown window, so it gets classified separately (see
      // BLOCKED_COOLDOWN_MS) instead of being retried every 10 minutes
      // like a generic "invalid" failure.
      return "blocked";
    }
    if (status === 403) return "invalid";
    if (status === 400 && (message.includes("api key not valid") || message.includes("api_key_invalid"))) {
      return "invalid";
    }
    if (status && status >= 500) return "server";
  }

  // NOTE: a 404 (model/endpoint not found) intentionally falls through to
  // "transient" here rather than "quota" or "invalid" — per the diagnostic
  // requirements, a 404 must never be classified as quota exhaustion. It
  // isn't classified as a key problem at all, since a wrong/retired model
  // id affects every key identically; retry.ts's normal retry handles it,
  // and it doesn't cool the key down (see cooldownFor's default case).
  return "transient";
}

function cooldownFor(kind: KeyFailureKind): number {
  switch (kind) {
    case "quota":
      return QUOTA_COOLDOWN_MS;
    case "blocked":
      return BLOCKED_COOLDOWN_MS;
    case "invalid":
      return INVALID_KEY_COOLDOWN_MS;
    case "server":
      return SERVER_ERROR_COOLDOWN_MS;
    default:
      return 0; // plain transient/network blips (including 404s) don't cool the key down
  }
}

/** Marks a key as failed for the appropriate cooldown window. Never logs the key itself. */
export function reportKeyFailure(index: number, err: unknown): KeyFailureKind {
  const pool = loadKeyPool();
  const state = pool[index];
  const kind = classifyFailure(err);
  if (!state) return kind;

  const cooldown = cooldownFor(kind);
  if (cooldown > 0) {
    state.cooldownUntil = Date.now() + cooldown;
    state.lastFailureReason = kind;
    logger.warn("ai.key_manager.key_cooldown", { key: label(index), reason: kind, cooldownMs: cooldown });
  } else {
    logger.warn("ai.key_manager.transient_failure", { key: label(index), reason: kind });
  }
  return kind;
}

/** Marks a key as currently working — future requests will try it first. */
export function reportKeySuccess(index: number): void {
  preferredIndex = index;
  const pool = loadKeyPool();
  if (pool[index]) pool[index].cooldownUntil = 0;
  logger.info("ai.key_manager.key_used", { key: label(index) });
}

/**
 * Returns keys in the order they should be attempted this call: the cached
 * last-known-good key first, then remaining non-cooling keys, then cooling
 * keys ordered by soonest-to-recover (never dropped entirely — if every key
 * is cooling down we'd rather retry the least-recently-failed one than
 * return nothing and fail immediately).
 */
export function getKeyOrder(): KeyState[] {
  const pool = loadKeyPool();
  if (pool.length === 0) return [];

  const now = Date.now();
  const available = pool.filter((k) => k.cooldownUntil <= now);
  const cooling = pool.filter((k) => k.cooldownUntil > now).sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  const ordered = [...available, ...cooling];

  const preferred = ordered.find((k) => k.index === preferredIndex);
  return preferred ? [preferred, ...ordered.filter((k) => k.index !== preferredIndex)] : ordered;
}

export function keyCount(): number {
  return loadKeyPool().length;
}

export type KeyHealthStatus = "healthy" | "cooling_down";

export interface KeyHealth {
  /** 1-based label, e.g. "key #2" — never the raw key value. */
  label: string;
  status: KeyHealthStatus;
  /** ms remaining until cooldown clears; 0 if not cooling. */
  cooldownRemainingMs: number;
  lastFailureReason: KeyFailureKind | null;
  /** True for the key future requests will try first. */
  isPreferred: boolean;
}

/**
 * Read-only snapshot of the whole pool's live health for display (Settings
 * > AI Control Center / AI Health Monitor). Never exposes key material —
 * only the same 1-based label already used in logs. Reflects this server
 * process's in-memory state only, by the same design trade-off documented
 * at the top of this file.
 */
export function getKeySnapshot(): KeyHealth[] {
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

/** Throws AIConfigError if no key is configured at all — distinct from "configured but exhausted". */
export function assertKeysConfigured(): void {
  if (keyCount() === 0) {
    throw new AIConfigError(
      "No Gemini API key is configured. Set GEMINI_API_KEY_1 (and optionally _2, _3, ...) or GEMINI_API_KEY."
    );
  }
}
