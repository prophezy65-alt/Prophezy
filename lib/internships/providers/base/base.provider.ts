import { hasEnv } from '../../config/env';
import type {
  FetchOptions,
  FetchResult,
  InternshipProvider,
  NormalizedInternship,
  ProviderDescriptor,
  ProviderHealth,
} from '../../types';
import { ProviderUnconfiguredError } from '../../utils/errors';
import { createLogger, type Logger } from '../../utils/logger';
import { isoNow } from '../../utils/date';
import { httpRequest, type HttpOptions } from '../../utils/http';

/**
 * Template-method base. Concrete providers implement `collect()` and inherit
 * configuration checks, rate-limit binding, timing, warning collection and health checks.
 */
export abstract class BaseProvider implements InternshipProvider {
  abstract readonly descriptor: ProviderDescriptor;
  protected readonly warnings: string[] = [];

  protected get log(): Logger {
    return createLogger('internships.provider', { provider: this.descriptor.key });
  }

  isConfigured(): boolean {
    return hasEnv(this.descriptor.requiredEnv);
  }

  /** URL used by the default health check. */
  protected abstract healthUrl(): string;

  /** Returns already-normalized postings. */
  protected abstract collect(options: FetchOptions): Promise<NormalizedInternship[]>;

  /** Raw count observed before filtering; overridden by providers that track it. */
  protected rawCount = 0;

  async fetch(options: FetchOptions = {}): Promise<FetchResult> {
    const startedAt = Date.now();
    this.warnings.length = 0;
    this.rawCount = 0;

    if (!this.isConfigured()) {
      throw new ProviderUnconfiguredError(this.descriptor.key, this.descriptor.requiredEnv);
    }

    const items = await this.collect(options);
    const capped = options.maxItems ? items.slice(0, options.maxItems) : items;

    return {
      provider: this.descriptor.key,
      items: capped,
      rawCount: this.rawCount || items.length,
      nextCursor: null,
      durationMs: Date.now() - startedAt,
      warnings: [...this.warnings],
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const checkedAt = isoNow();
    if (!this.isConfigured()) {
      return {
        provider: this.descriptor.key,
        status: 'unconfigured',
        reachable: false,
        latencyMs: null,
        message: `Missing env: ${this.descriptor.requiredEnv.join(', ')}`,
        checkedAt,
      };
    }
    const startedAt = Date.now();
    try {
      await this.request<unknown>(this.healthUrl(), { timeoutMs: 8_000, attempts: 1 });
      return {
        provider: this.descriptor.key,
        status: 'active',
        reachable: true,
        latencyMs: Date.now() - startedAt,
        message: 'OK',
        checkedAt,
      };
    } catch (error) {
      return {
        provider: this.descriptor.key,
        status: 'degraded',
        reachable: false,
        latencyMs: Date.now() - startedAt,
        message: (error as Error).message,
        checkedAt,
      };
    }
  }

  protected request<T>(url: string, options: HttpOptions = {}): Promise<T> {
    return httpRequest<T>(this.descriptor.key, url, {
      ...options,
      bucket: {
        key: this.descriptor.key,
        requestsPerMinute: this.descriptor.rateLimit.requestsPerMinute,
        minDelayMs: this.descriptor.rateLimit.minDelayMs,
      },
    });
  }

  protected warn(message: string): void {
    if (this.warnings.length < 25) this.warnings.push(message);
    this.log.warn(message);
  }
}
