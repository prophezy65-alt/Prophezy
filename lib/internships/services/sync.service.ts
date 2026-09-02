import { randomUUID } from 'node:crypto';
import { listDescriptors, listSyncableProviders, createProvider } from '../providers';
import { AggregatorService, type AggregationOutcome } from './aggregator.service';
import { SearchService } from './search.service';
import { InternshipRepository, SyncRepository, type SyncLogEntry } from '../db/repositories';
import { cache } from '../db/cache';
import { createLogger } from '../utils/logger';
import { isoNow } from '../utils/date';
import type { ProviderHealth } from '../types';

const log = createLogger('internships.sync');

/** After this many consecutive failures a provider is skipped until it recovers. */
const FAILURE_CIRCUIT_THRESHOLD = 5;
const STALE_POSTING_DAYS = 45;

export interface SyncSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  providersRun: number;
  providersFailed: number;
  totalFetched: number;
  totalPersisted: number;
  totalDuplicates: number;
  expiredClosed: number;
  staleClosed: number;
  embeddingsBackfilled: number;
  outcomes: AggregationOutcome[];
}

export class SyncService {
  constructor(
    private readonly aggregator = new AggregatorService(),
    private readonly search = new SearchService(),
    private readonly syncRepo = new SyncRepository(),
    private readonly internships = new InternshipRepository(),
  ) {}

  /**
   * Full scheduled sync. Incremental by default: each provider is asked only for
   * postings modified since its last successful run.
   */
  async runAll(options: { full?: boolean; providers?: string[]; maxItemsPerProvider?: number } = {}): Promise<SyncSummary> {
    const runId = randomUUID();
    const startedAt = isoNow();
    const scoped = options.providers?.length
      ? options.providers
          .map((key) => createProvider(key))
          .filter((p): p is NonNullable<typeof p> => p !== null)
      : listSyncableProviders();

    log.info('sync starting', { runId, providers: scoped.map((p) => p.descriptor.key), full: options.full ?? false });

    const outcomes: AggregationOutcome[] = [];
    let failed = 0;

    for (const provider of scoped) {
      const key = provider.descriptor.key;
      log.info('provider loop: entering', { provider: key });

      log.info('provider loop: fetching sync state', { provider: key });
      const state = await this.syncRepo.getProviderState(key).catch(() => null);
      log.info('provider loop: sync state fetched', { provider: key, consecutiveFailures: state?.consecutiveFailures ?? 0 });

      if (state && state.consecutiveFailures >= FAILURE_CIRCUIT_THRESHOLD) {
        log.warn('provider skipped — failure circuit open', { provider: key, failures: state.consecutiveFailures });
        continue;
      }

      log.info('provider loop: resolving since-cursor', { provider: key, full: options.full ?? false });
      const since = options.full ? undefined : (await this.syncRepo.lastSuccessfulSync(key)) ?? undefined;
      log.info('provider loop: since-cursor resolved', { provider: key, since: since ?? null });
      const providerStartedAt = isoNow();

      try {
        log.info('provider loop: calling aggregator.runProvider()', { provider: key });
        const outcome = await this.aggregator.runProvider(provider, {
          since,
          maxItems: options.maxItemsPerProvider ?? 1_000,
        });
        log.info('provider loop: aggregator.runProvider() returned', { provider: key, persisted: outcome.persisted });
        outcomes.push(outcome);

        log.info('provider loop: calling recordRun() [success]', { provider: key });
        await this.recordRun({
          provider: key,
          runId,
          status: outcome.warnings.length > 0 ? 'partial' : 'success',
          fetched: outcome.fetched,
          normalized: outcome.normalized,
          duplicates: outcome.duplicates,
          inserted: outcome.persisted,
          updated: 0,
          durationMs: outcome.durationMs,
          error: null,
          warnings: outcome.warnings,
          startedAt: providerStartedAt,
          finishedAt: isoNow(),
        });
        log.info('provider loop: recordRun() returned [success]', { provider: key });

        log.info('provider loop: calling upsertProviderHealth() [success]', { provider: key });
        await this.syncRepo.upsertProviderHealth(this.healthFrom(provider.descriptor.key, true, 'OK'), 0);
        log.info('provider loop: upsertProviderHealth() returned [success]', { provider: key });
      } catch (error) {
        failed += 1;
        const message = (error as Error).message;
        log.error('provider sync failed', { provider: key, error: message });

        log.info('provider loop: calling recordRun() [failed]', { provider: key });
        await this.recordRun({
          provider: key,
          runId,
          status: 'failed',
          fetched: 0, normalized: 0, duplicates: 0, inserted: 0, updated: 0,
          durationMs: 0,
          error: message,
          warnings: [],
          startedAt: providerStartedAt,
          finishedAt: isoNow(),
        });
        log.info('provider loop: recordRun() returned [failed]', { provider: key });

        log.info('provider loop: calling upsertProviderHealth() [failed]', { provider: key });
        await this.syncRepo.upsertProviderHealth(
          this.healthFrom(key, false, message),
          (state?.consecutiveFailures ?? 0) + 1,
        );
        log.info('provider loop: upsertProviderHealth() returned [failed]', { provider: key });
      }

      log.info('provider loop: exiting — moving to next provider', { provider: key });
    }

    log.info('post-loop: calling deactivateExpired()', {});
    const expiredClosed = await this.internships.deactivateExpired().catch(() => 0);
    log.info('post-loop: deactivateExpired() returned', { expiredClosed });

    log.info('post-loop: calling deactivateStale()', {});
    const staleClosed = await this.internships.deactivateStale(STALE_POSTING_DAYS).catch(() => 0);
    log.info('post-loop: deactivateStale() returned', { staleClosed });

    log.info('post-loop: calling backfillEmbeddings()', {});
    const embeddingsBackfilled = await this.search.backfillEmbeddings(200).catch((error: unknown) => {
      log.warn('embedding backfill failed', { error: (error as Error).message });
      return 0;
    });
    log.info('post-loop: backfillEmbeddings() returned', { embeddingsBackfilled });

    log.info('post-loop: calling cache.del()', {});
    await cache.del('internships:search');
    log.info('post-loop: cache.del() returned', {});

    const summary: SyncSummary = {
      runId,
      startedAt,
      finishedAt: isoNow(),
      providersRun: outcomes.length,
      providersFailed: failed,
      totalFetched: sum(outcomes.map((o) => o.fetched)),
      totalPersisted: sum(outcomes.map((o) => o.persisted)),
      totalDuplicates: sum(outcomes.map((o) => o.duplicates)),
      expiredClosed,
      staleClosed,
      embeddingsBackfilled,
      outcomes,
    };

    log.info('sync complete', { ...summary, outcomes: undefined });
    return summary;
  }

  /** Probes every registered provider and records the result. */
  async checkAllHealth(): Promise<ProviderHealth[]> {
    const results: ProviderHealth[] = [];
    for (const descriptor of listDescriptors()) {
      const provider = createProvider(descriptor.key);
      if (!provider) continue;
      const health = await provider.healthCheck();
      results.push(health);
      const state = await this.syncRepo.getProviderState(descriptor.key).catch(() => null);
      const failures = health.reachable ? 0 : (state?.consecutiveFailures ?? 0) + 1;
      await this.syncRepo.upsertProviderHealth(health, failures).catch(() => undefined);
    }
    return results;
  }

  async recentRuns(limit = 50): Promise<SyncLogEntry[]> {
    return this.syncRepo.recentRuns(limit);
  }

  private async recordRun(entry: SyncLogEntry): Promise<void> {
    await this.syncRepo.recordRun(entry).catch((error: unknown) => {
      log.warn('failed to write sync log', { error: (error as Error).message });
    });
  }

  private healthFrom(provider: string, reachable: boolean, message: string): ProviderHealth {
    return {
      provider,
      status: reachable ? 'active' : 'degraded',
      reachable,
      latencyMs: null,
      message,
      checkedAt: isoNow(),
    };
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}
