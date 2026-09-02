/**
 * lib/ai/middleware/rate-limit.ts
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * Right now, nothing stops one user (or a bug/loop in the frontend) from
 * firing enough requests to burn through your entire key-rotation pool
 * alone — every failed screenshot in this conversation showed ALL 16 keys
 * exhausted from what was very likely a small handful of real users
 * testing. At 5,000 real users, without a per-user cap, your quota is
 * "first 20 impatient users at 9am" instead of "shared fairly across
 * everyone all day." This is a second, independent lever from caching
 * (§2) — caching reduces total call volume, this bounds any single
 * user's share of it.
 *
 * Same Upstash Redis credentials as response-cache.ts. Fails OPEN (allows
 * the request) if Redis is unreachable — a rate limiter that itself takes
 * the product down on a Redis blip is worse than no rate limiter.
 */
import "server-only";
import { Redis } from "@upstash/redis";
import { logger } from "../utils/logger";

let client: Redis | null = null;

function getClient(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window, if known. */
  remaining?: number;
  /** Seconds until the window resets, if known. */
  retryAfterSeconds?: number;
}

/**
 * Fixed-window limiter (simple, one Redis round trip) — not a true
 * sliding window, which is fine for this purpose: the goal is "stop
 * runaway usage," not billing-grade precision.
 *
 * @param identity  Usually `userId`, but can be any string you want a
 *                  shared budget for (e.g. `"anon:" + ip` for
 *                  unauthenticated endpoints).
 * @param feature   e.g. "research" — limits are per (identity, feature),
 *                  so a user maxing out Research chat doesn't also block
 *                  their Flashcards usage.
 */
export async function checkRateLimit(
  identity: string,
  feature: string,
  opts: { limit: number; windowSeconds: number }
): Promise<RateLimitResult> {
  const redis = getClient();
  if (!redis) {
    logger.warn("ai.rate_limit.disabled", { reason: "UPSTASH_REDIS_REST_URL/TOKEN not set", feature });
    return { allowed: true };
  }

  const windowKey = `ai:ratelimit:${feature}:${identity}:${Math.floor(Date.now() / 1000 / opts.windowSeconds)}`;

  try {
    const count = await redis.incr(windowKey);
    if (count === 1) {
      // Only the request that created this window key needs to set its
      // expiry — every subsequent incr() in the same window is a no-op here.
      await redis.expire(windowKey, opts.windowSeconds);
    }

    if (count > opts.limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds: opts.windowSeconds };
    }
    return { allowed: true, remaining: Math.max(0, opts.limit - count) };
  } catch (err) {
    logger.warn("ai.rate_limit.check_failed", { feature, error: err instanceof Error ? err.message : String(err) });
    return { allowed: true }; // fail open — see file header
  }
}

/**
 * Reasonable starting per-user-per-feature budgets. These bound how much
 * of your OWN quota one user can consume, independent of whatever Gemini
 * itself allows — tune based on real usage once ai_usage_events has a
 * few days of data. AI-heavy features (research, roadmap) get a tighter
 * window than lightweight ones (flashcards).
 */
export const RATE_LIMITS: Record<string, { limit: number; windowSeconds: number }> = {
  research: { limit: 20, windowSeconds: 60 * 60 }, // 20 AI research calls/hour/user
  assignment: { limit: 15, windowSeconds: 60 * 60 },
  interview: { limit: 10, windowSeconds: 60 * 60 },
  roadmap: { limit: 5, windowSeconds: 60 * 60 },
  quiz: { limit: 40, windowSeconds: 60 * 60 },
  flashcards: { limit: 40, windowSeconds: 60 * 60 },
};

export class RateLimitExceededError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Rate limit exceeded. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitExceededError";
  }
}

/** Throws RateLimitExceededError if the caller is over budget — convenience
 *  wrapper for call sites that want a throw instead of branching on the
 *  result themselves. */
export async function enforceRateLimit(identity: string, feature: string): Promise<void> {
  const config = RATE_LIMITS[feature];
  if (!config) return; // no configured limit for this feature — allow
  const result = await checkRateLimit(identity, feature, config);
  if (!result.allowed) throw new RateLimitExceededError(result.retryAfterSeconds ?? config.windowSeconds);
}
