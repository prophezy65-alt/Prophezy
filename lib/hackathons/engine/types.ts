/**
 * lib/hackathons/engine/types.ts
 *
 * Mirrors lib/internships/types/provider.types.ts's shape exactly, adapted
 * to hackathons. Kept as its own file (not reusing the internship module's
 * type file directly) because the payload shape is genuinely different —
 * but every *behavioral* contract (health check, fetch result envelope,
 * error handling) is intentionally identical so ProviderRegistry/
 * SyncService read the same way a developer already familiar with the
 * internship engine expects.
 */

import type { Hackathon, HackathonSourceId } from "../models/hackathon.model";

export interface ProviderHealth {
  key: HackathonSourceId;
  status: "healthy" | "degraded" | "down" | "unsupported";
  reachable: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

export interface FetchResult {
  hackathons: Hackathon[];
  fetchedCount: number;
  hasMore: boolean;
  nextCursor?: string;
  warnings: string[];
}

export interface FetchOptions {
  /** Only fetch hackathons updated/created after this ISO timestamp, when the source supports it. */
  since?: string;
  /** Max number of hackathons to fetch in this call — bounds a single sync run against one source. */
  limit?: number;
  signal?: AbortSignal;
}

export interface HackathonProvider {
  readonly key: HackathonSourceId;
  readonly displayName: string;
  readonly isImplemented: boolean;
  /** Legal/ToS basis for why this source can be fetched programmatically — required even for stubs, so the registry itself documents the "only sources whose Terms allow crawling" rule rather than relying on a comment nobody reads. */
  readonly accessBasis: "public_api" | "public_json" | "rss" | "unsupported";
  fetchAll(options?: FetchOptions): Promise<FetchResult>;
  checkHealth(): Promise<ProviderHealth>;
}

export interface ProviderDescriptor {
  key: HackathonSourceId;
  displayName: string;
  isImplemented: boolean;
  accessBasis: "public_api" | "public_json" | "rss" | "unsupported";
  /** Why this source is or isn't implemented — shown in the health/status endpoint and README, not just a code comment. */
  integrationNote: string;
  factory: () => HackathonProvider;
}

export interface SyncRunResult {
  provider: HackathonSourceId;
  status: "success" | "partial" | "failed" | "skipped";
  fetched: number;
  normalized: number;
  duplicates: number;
  inserted: number;
  updated: number;
  durationMs: number;
  error?: string;
  warnings: string[];
  startedAt: string;
  finishedAt: string;
}

export interface SyncSummary {
  runId: string;
  mode: "incremental" | "full";
  startedAt: string;
  finishedAt: string;
  results: SyncRunResult[];
  totalInserted: number;
  totalUpdated: number;
  totalDuplicates: number;
  totalFailed: number;
}
