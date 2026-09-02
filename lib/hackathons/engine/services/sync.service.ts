/**
 * lib/hackathons/engine/services/sync.service.ts
 *
 * Mirrors lib/internships/services/sync.service.ts's orchestration logic
 * exactly: circuit breaker (skip a provider after N consecutive failures
 * rather than hammering a source that's clearly down), incremental vs
 * full sync modes, provider health recorded to the DB every run, and an
 * expiry step. Delegates the actual fetch/normalize/dedupe/persist work to
 * HackathonAggregatorService — this file is purely orchestration, same
 * separation of concerns as the internship engine.
 */

import { randomUUID } from "node:crypto";
import type { HackathonProvider, SyncSummary } from "../types";
import { HackathonAggregatorService } from "./aggregator.service";
import { HackathonSyncRepository } from "../db/hackathon-sync.repository";
import { getProviderDescriptor } from "../providers/provider-registry";
import { createLogger } from "../../../internships/utils/logger";

const log = createLogger("hackathons.sync");

const CIRCUIT_BREAKER_THRESHOLD = 5; // matches the internship engine's own threshold
const DEFAULT_RETENTION_DAYS = 30;

export interface SyncOptions {
  mode?: "incremental" | "full";
  providers?: HackathonProvider[];
  retentionDays?: number;
  skipExpiry?: boolean;
}

export class HackathonSyncService {
  constructor(
    private readonly aggregator: HackathonAggregatorService,
    private readonly syncRepo: HackathonSyncRepository = new HackathonSyncRepository()
  ) {}

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const mode = options.mode ?? "incremental";
    const providers = options.providers ?? [];

    log.info("sync run starting", { runId, mode, providerCount: providers.length });

    const results = [];
    for (const provider of providers) {
      const descriptor = getProviderDescriptor(provider.key);
      const state = await this.syncRepo.getProviderState(provider.key).catch(() => null);
      const consecutiveFailures = state?.consecutiveFailures ?? 0;

      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        log.warn("circuit breaker open — skipping provider", { provider: provider.key, consecutiveFailures });
        const health = await provider.checkHealth().catch(() => null);
        if (health) {
          await this.syncRepo
            .upsertProviderHealth(health, consecutiveFailures, provider.isImplemented, descriptor?.displayName ?? provider.displayName)
            .catch((e) => log.error("failed to record health during circuit-break skip", { provider: provider.key, error: String(e) }));
        }
        continue;
      }

      const since = mode === "incremental" ? await this.syncRepo.lastSuccessfulSync(provider.key).catch(() => undefined) : undefined;
      const result = await this.aggregator.runProvider(provider, { since: since ?? undefined });

      await this.syncRepo.recordRun({ ...result, runId }).catch((e) => log.error("failed to record sync run", { provider: provider.key, error: String(e) }));

      const nextFailures = result.status === "failed" ? consecutiveFailures + 1 : 0;
      const health = await provider.checkHealth().catch(() => ({
        key: provider.key,
        status: result.status === "failed" ? ("down" as const) : ("healthy" as const),
        reachable: result.status !== "failed",
        message: result.error,
        checkedAt: new Date().toISOString(),
      }));
      await this.syncRepo
        .upsertProviderHealth(health, nextFailures, provider.isImplemented, descriptor?.displayName ?? provider.displayName)
        .catch((e) => log.error("failed to record provider health", { provider: provider.key, error: String(e) }));

      results.push(result);
    }

    if (!options.skipExpiry) {
      try {
        const deleted = await this.syncRepo.deleteExpired(options.retentionDays ?? DEFAULT_RETENTION_DAYS);
        if (deleted > 0) log.info("expired hackathons deleted", { count: deleted, retentionDays: options.retentionDays ?? DEFAULT_RETENTION_DAYS });
      } catch (error) {
        log.error("expiry cleanup failed", { error: error instanceof Error ? error.message : String(error) });
      }
    }

    const finishedAt = new Date().toISOString();
    const summary: SyncSummary = {
      runId,
      mode,
      startedAt,
      finishedAt,
      results,
      totalInserted: results.reduce((sum, r) => sum + r.inserted, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
      totalDuplicates: results.reduce((sum, r) => sum + r.duplicates, 0),
      totalFailed: results.filter((r) => r.status === "failed").length,
    };

    log.info("sync run complete", { ...summary, results: undefined });
    return summary;
  }

  async checkAllHealth(providers: HackathonProvider[]) {
    return Promise.all(
      providers.map(async (provider) => {
        const health = await provider.checkHealth();
        const state = await this.syncRepo.getProviderState(provider.key).catch(() => null);
        return { ...health, consecutiveFailures: state?.consecutiveFailures ?? 0 };
      })
    );
  }

  async recentRuns(limit = 50) {
    return this.syncRepo.recentRuns(limit);
  }
}
