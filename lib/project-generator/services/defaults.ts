/**
 * lib/project-generator/services/defaults.ts
 *
 * Working default implementations of the DI contracts from `types.ts`.
 * These are real, fully-functional implementations — not mocks or stubs —
 * suitable for local development and as a fallback in production. In
 * production you will typically inject:
 *   - `logger`: an adapter over `lib/ai/utils/logger.ts` (structured JSON logs)
 *   - `cache`: an adapter over `lib/ai/middleware/cache.ts` (Upstash Redis)
 * and keep `SystemClock` / `UuidGenerator` as-is.
 */

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ok, err, Result, GenerationError } from "../models";
import type { BundleUploader } from "./export.service";
import type { CacheProvider, Clock, IdGenerator, Logger } from "./types";

/** Structured JSON console logger. Safe for serverless/edge runtimes. */
export class ConsoleLogger implements Logger {
  constructor(private readonly scope: string = "project-generator") {}

  private write(level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
    const entry = {
      level,
      scope: this.scope,
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.write("info", message, context);
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.write("warn", message, context);
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.write("error", message, context);
  }
}

/**
 * Working in-process cache with TTL eviction. Fully functional for a single
 * server instance / dev environment. Swap for a Redis-backed `CacheProvider`
 * (e.g. wrapping `lib/ai/middleware/cache.ts`) to share cache across
 * serverless invocations and instances.
 */
export class InMemoryCacheProvider implements CacheProvider {
  private readonly store = new Map<string, { readonly value: unknown; readonly expiresAtMs: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAtMs <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    this.store.set(key, { value, expiresAtMs: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Evicts every expired entry. Call periodically in long-lived processes to bound memory. */
  sweepExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAtMs <= now) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

export class SystemClock implements Clock {
  nowISO(): string {
    return new Date().toISOString();
  }
  nowMs(): number {
    return Date.now();
  }
}

export class UuidGenerator implements IdGenerator {
  newId(): string {
    return randomUUID();
  }
}

/**
 * Working `BundleUploader` that writes ZIPs to local disk under `baseDir`.
 * Suitable for local development. In production, swap for a Supabase
 * Storage-backed uploader (same `BundleUploader` interface) that uploads
 * to the `project-exports` storage bucket and returns a signed URL.
 */
export class LocalFilesystemBundleUploader implements BundleUploader {
  constructor(private readonly baseDir: string) {}

  async upload(input: { readonly relativePath: string; readonly data: Buffer; readonly contentType: string }): Promise<
    Result<string, GenerationError>
  > {
    try {
      const fullPath = join(this.baseDir, input.relativePath);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, input.data);
      return ok(fullPath);
    } catch (error) {
      return err({
        code: "INTERNAL_ERROR",
        message: `LocalFilesystemBundleUploader failed to write "${input.relativePath}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        retryable: true,
        cause: error,
      });
    }
  }
}

export function createDefaultServiceContext(scope?: string): {
  readonly cache: InMemoryCacheProvider;
  readonly logger: ConsoleLogger;
  readonly clock: SystemClock;
  readonly ids: UuidGenerator;
} {
  return {
    cache: new InMemoryCacheProvider(),
    logger: new ConsoleLogger(scope),
    clock: new SystemClock(),
    ids: new UuidGenerator(),
  };
}
