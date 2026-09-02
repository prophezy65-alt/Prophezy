/**
 * lib/hackathons/engine/providers/base-hackathon-provider.ts
 *
 * Template-method base mirroring lib/internships/providers/base/base.provider.ts
 * exactly: concrete providers implement `collect()`; this handles timing,
 * warning collection, and health checks. Rate limiting, retry-with-backoff,
 * and the actual HTTP call are NOT reimplemented here — they're the real
 * lib/internships/utils/{http,retry,rate-limiter} functions, imported
 * directly. Simplified from the internship base in one place: no
 * isConfigured()/requiredEnv step, since every real hackathon source here
 * (Devpost, GitHub Events) is a genuinely public, keyless endpoint — a
 * future provider that needs an API key can add that check back the same
 * way BaseProvider does.
 */

import type { HackathonSourceId } from "../../models/hackathon.model";
import type { FetchOptions, FetchResult, HackathonProvider, ProviderHealth } from "../types";
import { httpRequest, type HttpOptions } from "../../../internships/utils/http";
import { createLogger, type Logger } from "../../../internships/utils/logger";

export interface RateLimitConfig {
  requestsPerMinute: number;
  minDelayMs: number;
}

export abstract class BaseHackathonProvider implements HackathonProvider {
  abstract readonly key: HackathonSourceId;
  abstract readonly displayName: string;
  abstract readonly isImplemented: boolean;
  abstract readonly accessBasis: "public_api" | "public_json" | "rss" | "unsupported";
  protected abstract readonly rateLimit: RateLimitConfig;

  protected readonly warnings: string[] = [];

  protected get log(): Logger {
    return createLogger("hackathons.provider", { provider: this.key });
  }

  /** URL used by the default health check — typically the same endpoint fetchAll() hits, with a small limit. */
  protected abstract healthUrl(): string;

  /** Concrete providers implement this — returns already-normalized Hackathon[] via FetchResult. */
  protected abstract collect(options: FetchOptions): Promise<FetchResult>;

  async fetchAll(options: FetchOptions = {}): Promise<FetchResult> {
    this.warnings.length = 0;
    const result = await this.collect(options);
    return { ...result, warnings: [...this.warnings, ...result.warnings] };
  }

  async checkHealth(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    const startedAt = Date.now();
    try {
      await this.request<unknown>(this.healthUrl(), { timeoutMs: 8_000, attempts: 1 });
      return { key: this.key, status: "healthy", reachable: true, latencyMs: Date.now() - startedAt, message: "OK", checkedAt };
    } catch (error) {
      return {
        key: this.key,
        status: "down",
        reachable: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "Unknown error",
        checkedAt,
      };
    }
  }

  /** Every outbound request goes through this — reuses the real internship engine's rate limiter + retry + timeout + truthful User-Agent, not a reimplementation. */
  protected request<T>(url: string, options: HttpOptions = {}): Promise<T> {
    return httpRequest<T>(this.key, url, {
      ...options,
      bucket: { key: this.key, requestsPerMinute: this.rateLimit.requestsPerMinute, minDelayMs: this.rateLimit.minDelayMs },
    });
  }

  protected warn(message: string): void {
    if (this.warnings.length < 25) this.warnings.push(message);
    this.log.warn(message);
  }
}
