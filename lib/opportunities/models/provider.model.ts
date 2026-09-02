/**
 * lib/opportunities/models/provider.model.ts
 *
 * The provider interface every opportunity source implements. This is the
 * primary extension point of the engine: adding a new source (a new job
 * board, hackathon platform, RSS feed, etc.) means implementing
 * `OpportunityProvider` and registering it — nothing else in the engine
 * needs to change (Open/Closed principle).
 */

import { OpportunityType, ProviderAuthType, ProviderKind, SyncStatus, SyncTrigger, ValidationSeverity } from "./enums";
import { ISODateString, OpportunityEngineError, Result, Sha256Hex, UUID, isNonEmptyString } from "./shared.model";
import { NormalizedOpportunityDraft } from "./opportunity.model";

export interface RateLimitPolicy {
  readonly requestsPerInterval: number;
  readonly intervalSeconds: number;
  readonly maxConcurrentRequests: number;
}

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
}

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = {
  requestsPerInterval: 30,
  intervalSeconds: 60,
  maxConcurrentRequests: 4,
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 500,
  maxDelayMs: 15_000,
  backoffMultiplier: 2,
};

export interface ProviderConfig {
  readonly id: string; // stable slug, e.g. "devpost", "linkedin-jobs", "unstop"
  readonly displayName: string;
  readonly kind: ProviderKind;
  readonly authType: ProviderAuthType;
  readonly baseUrl: string;
  readonly supportedTypes: readonly OpportunityType[];
  readonly rateLimit: RateLimitPolicy;
  readonly retry: RetryPolicy;
  readonly syncIntervalMinutes: number;
  readonly enabled: boolean;
  /** Secret material (API keys, tokens) is referenced by env-var name, never stored inline. */
  readonly credentialEnvVarNames: readonly string[];
}

/** One unnormalized record as returned by a provider's `fetch()`, before `normalize()` runs. */
export interface RawOpportunityRecord {
  readonly providerId: string;
  readonly externalId: string; // the provider's own identifier for this record
  readonly payload: Record<string, unknown>; // opaque raw payload, shape is provider-specific
  readonly sourceUrl: string | null;
  readonly fetchedAt: ISODateString;
  readonly rawContentHash: Sha256Hex; // hash of `payload`, used for change detection between syncs
}

export interface ProviderFetchContext {
  /** When present, providers implementing incremental sync should only return records changed since this timestamp. */
  readonly since: ISODateString | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface ProviderFetchResult {
  readonly records: readonly RawOpportunityRecord[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface ValidationIssue {
  readonly field: string;
  readonly message: string;
  readonly severity: ValidationSeverity;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface ProviderSyncContext {
  readonly syncId: UUID;
  readonly trigger: SyncTrigger;
  readonly since: ISODateString | null;
}

export interface SyncResult {
  readonly syncId: UUID;
  readonly providerId: string;
  readonly trigger: SyncTrigger;
  readonly status: SyncStatus;
  readonly startedAt: ISODateString;
  readonly finishedAt: ISODateString;
  readonly itemsFetched: number;
  readonly itemsCreated: number;
  readonly itemsUpdated: number;
  readonly itemsSkipped: number;
  readonly itemsFailed: number;
  readonly errorSummaries: readonly string[];
}

/**
 * The interface every opportunity source implements. Providers are pure
 * with respect to the rest of the engine — they know how to talk to one
 * external source and how to shape its data, and nothing about caching,
 * dedup, indexing, or storage.
 */
export interface OpportunityProvider {
  readonly config: ProviderConfig;

  /** Fetches one page of raw records from the external source. */
  fetch(context: ProviderFetchContext): Promise<Result<ProviderFetchResult, OpportunityEngineError>>;

  /** Maps one raw record into a `NormalizedOpportunityDraft`. Pure — no I/O. */
  normalize(record: RawOpportunityRecord): Result<NormalizedOpportunityDraft, OpportunityEngineError>;

  /** Structural + business-rule validation of a normalized draft before it enters the pipeline. Pure — no I/O. */
  validate(draft: NormalizedOpportunityDraft): ValidationResult;

  /**
   * Orchestrates one full sync run for this provider (fetch -> normalize ->
   * validate for every page) and returns a `SyncResult` summary. The
   * concrete implementation lives in `services/`; this signature is the
   * contract `sync/` and `registry/` code against.
   */
  sync(context: ProviderSyncContext): Promise<Result<SyncResult, OpportunityEngineError>>;
}

export function validateProviderConfig(config: ProviderConfig): string[] {
  const problems: string[] = [];
  if (!isNonEmptyString(config.id)) problems.push("ProviderConfig.id is required.");
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(config.id)) {
    problems.push(`ProviderConfig.id "${config.id}" must be a lowercase kebab-case slug.`);
  }
  if (!isNonEmptyString(config.displayName)) problems.push("ProviderConfig.displayName is required.");
  if (!isNonEmptyString(config.baseUrl)) problems.push("ProviderConfig.baseUrl is required.");
  if (config.supportedTypes.length === 0) problems.push("ProviderConfig.supportedTypes must contain at least one type.");
  if (config.rateLimit.requestsPerInterval <= 0) problems.push("rateLimit.requestsPerInterval must be positive.");
  if (config.rateLimit.intervalSeconds <= 0) problems.push("rateLimit.intervalSeconds must be positive.");
  if (config.rateLimit.maxConcurrentRequests <= 0) problems.push("rateLimit.maxConcurrentRequests must be positive.");
  if (config.retry.maxAttempts <= 0) problems.push("retry.maxAttempts must be positive.");
  if (config.retry.backoffMultiplier <= 1) problems.push("retry.backoffMultiplier must be greater than 1.");
  if (config.syncIntervalMinutes <= 0) problems.push("syncIntervalMinutes must be positive.");
  if (config.authType !== "none" && config.credentialEnvVarNames.length === 0) {
    problems.push(`ProviderConfig.authType is "${config.authType}" but credentialEnvVarNames is empty.`);
  }
  return problems;
}
