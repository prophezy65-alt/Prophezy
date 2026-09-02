/**
 * lib/opportunities/models/analytics.model.ts
 *
 * Aggregate statistics derived from `opportunities`, `provider_sync`, and
 * `provider_health` — powers admin dashboards ("which providers are
 * healthy", "how many opportunities did we ingest this week") without any
 * per-user recommendation logic, which stays out of this engine entirely.
 */

import { OpportunityType, ProviderHealthState } from "./enums";
import { ISODateString, isNonEmptyString } from "./shared.model";

export interface ProviderStatistics {
  readonly providerId: string;
  readonly displayName: string;
  readonly healthState: ProviderHealthState;
  readonly totalOpportunitiesContributed: number;
  readonly activeOpportunityCount: number;
  readonly totalSyncRuns: number;
  readonly successfulSyncRuns: number;
  readonly failedSyncRuns: number;
  readonly averageSyncDurationMs: number;
  readonly lastSyncAt: ISODateString | null;
  readonly duplicateRate: number; // fraction of this provider's records that were merged as duplicates, 0-1
}

export interface SyncHistoryPoint {
  readonly date: ISODateString; // day bucket, e.g. "2026-07-23"
  readonly totalRuns: number;
  readonly successfulRuns: number;
  readonly failedRuns: number;
  readonly itemsIngested: number;
}

export interface OpportunityTypeBreakdown {
  readonly type: OpportunityType;
  readonly activeCount: number;
  readonly totalCount: number;
}

export interface EngineAnalyticsSnapshot {
  readonly generatedAt: ISODateString;
  readonly totalOpportunities: number;
  readonly activeOpportunities: number;
  readonly expiredOpportunities: number;
  readonly totalProviders: number;
  readonly healthyProviders: number;
  readonly degradedProviders: number;
  readonly downProviders: number;
  readonly typeBreakdown: readonly OpportunityTypeBreakdown[];
  readonly topProvidersByVolume: readonly ProviderStatistics[];
  readonly syncHistory: readonly SyncHistoryPoint[];
}

export function providerSuccessRate(stats: ProviderStatistics): number {
  if (stats.totalSyncRuns === 0) return 1;
  return stats.successfulSyncRuns / stats.totalSyncRuns;
}

export function rankProvidersByVolume(stats: readonly ProviderStatistics[], limit = 10): ProviderStatistics[] {
  return [...stats].sort((a, b) => b.totalOpportunitiesContributed - a.totalOpportunitiesContributed).slice(0, limit);
}

export function validateProviderStatistics(stats: ProviderStatistics): string[] {
  const problems: string[] = [];
  if (!isNonEmptyString(stats.providerId)) problems.push("ProviderStatistics.providerId is required.");
  if (stats.activeOpportunityCount > stats.totalOpportunitiesContributed) {
    problems.push("ProviderStatistics.activeOpportunityCount cannot exceed totalOpportunitiesContributed.");
  }
  if (stats.successfulSyncRuns + stats.failedSyncRuns > stats.totalSyncRuns) {
    problems.push("ProviderStatistics: successfulSyncRuns + failedSyncRuns cannot exceed totalSyncRuns.");
  }
  if (stats.duplicateRate < 0 || stats.duplicateRate > 1) {
    problems.push("ProviderStatistics.duplicateRate must be within 0-1.");
  }
  return problems;
}
