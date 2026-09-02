import type { FetchOptions, InternshipProvider, NormalizedInternship } from '../types';
import { NormalizerService } from './normalizer.service';
import { DeduplicationService } from './deduplication.service';
import { RankingService } from './ranking.service';
import { InternshipRepository } from '../db/repositories';
import { createLogger } from '../utils/logger';
import { isExpired } from '../utils/date';

const log = createLogger('internships.aggregator');

/**
 * Hard ceiling on the AI-enrichment stage for one provider's batch.
 *
 * Without this, `enrichWithAI()` has no upper bound: each Gemini call can take
 * up to ~45s * 3 attempts (~140s) before giving up on a single item, and with
 * up to 200 items at concurrency 4 that's a worst case of ~2 hours — during
 * which NOTHING is logged (mapWithConcurrency only reports per-item results
 * after the entire batch settles), so it is indistinguishable from a genuine
 * hang. This budget bounds that: if enrichment isn't done in time, we log it
 * and move on with deterministic-only values for whatever didn't finish, so
 * one slow/misconfigured AI call can never block the rest of the sync run.
 */
const AI_ENRICHMENT_BUDGET_MS = 90_000;

export interface AggregationOutcome {
  provider: string;
  fetched: number;
  normalized: number;
  duplicates: number;
  persisted: number;
  durationMs: number;
  warnings: string[];
}

/**
 * Runs the pipeline for a single provider:
 *   provider -> normalize -> enrich -> dedupe -> rank -> persist
 * Kept separate from `SyncService` so it can also be invoked ad hoc
 * (admin "resync this provider now", tests, backfills).
 */
export class AggregatorService {
  constructor(
    private readonly normalizer = new NormalizerService(),
    private readonly deduplication = new DeduplicationService(),
    private readonly ranking = new RankingService(),
    private readonly repo = new InternshipRepository(),
  ) {}

  async runProvider(
    provider: InternshipProvider,
    options: FetchOptions & { aiEnrichment?: boolean } = {},
  ): Promise<AggregationOutcome> {
    const startedAt = Date.now();
    const key = provider.descriptor.key;

    const result = await provider.fetch(options);
    log.info('provider fetch complete', {
      provider: key,
      fetched: result.items.length,
      rawCount: result.rawCount,
      durationMs: result.durationMs,
    });

    const deterministic = result.items
      .map((item) => this.normalizer.enrichDeterministic(item))
      .filter((item) => this.isWorthKeeping(item));
    log.info('deterministic pass complete', { provider: key, kept: deterministic.length });

    let enriched = deterministic;
    if (options.aiEnrichment !== false) {
      const needsAi = deterministic.filter((item) => this.normalizer.needsAiEnrichment(item));
      const rest = deterministic.filter((item) => !this.normalizer.needsAiEnrichment(item));
      log.info('AI enrichment scope', { provider: key, needsAi: needsAi.length, skipped: rest.length });

      if (needsAi.length > 0) {
        const batch = needsAi.slice(0, 200);
        log.info('AI enrichment starting', { provider: key, batchSize: batch.length, budgetMs: AI_ENRICHMENT_BUDGET_MS });
        const enrichStartedAt = Date.now();

        const aiEnriched = await this.enrichWithBudget(batch, key);

        log.info('AI enrichment finished', {
          provider: key,
          durationMs: Date.now() - enrichStartedAt,
          timedOut: aiEnriched === null,
        });

        enriched = [...rest, ...(aiEnriched ?? batch), ...needsAi.slice(200)];
      }
    }

    log.info('starting dedupe', { provider: key, count: enriched.length });
    const { merged, duplicatesRemoved } = this.deduplication.dedupe(enriched);
    log.info('dedupe complete', { provider: key, merged: merged.length, duplicatesRemoved });

    const scores = merged.map((item) => this.ranking.qualityScore(item));

    log.info('calling repo.upsertMany()', { provider: key, count: merged.length });
    const persisted = await this.repo.upsertMany(merged, scores);
    log.info('repo.upsertMany() returned', { provider: key, persisted });

    return {
      provider: key,
      fetched: result.items.length,
      normalized: enriched.length,
      duplicates: duplicatesRemoved,
      persisted,
      durationMs: Date.now() - startedAt,
      warnings: result.warnings,
    };
  }

  /**
   * Runs enrichWithAI but never waits longer than AI_ENRICHMENT_BUDGET_MS.
   * Returns null on timeout (caller falls back to deterministic values).
   * The orphaned Gemini calls are abandoned, not cancelled — Node lets them
   * settle in the background; their results are simply never awaited again.
   */
  private async enrichWithBudget(
    batch: readonly NormalizedInternship[],
    providerKey: string,
  ): Promise<NormalizedInternship[] | null> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        log.warn('AI enrichment budget exceeded — continuing with deterministic values', {
          provider: providerKey,
          budgetMs: AI_ENRICHMENT_BUDGET_MS,
          batchSize: batch.length,
        });
        resolve(null);
      }, AI_ENRICHMENT_BUDGET_MS);
    });

    try {
      return await Promise.race([this.normalizer.enrichWithAI(batch), timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  /** Runs several providers, merging across providers before persisting. */
  async runMany(
    providers: readonly InternshipProvider[],
    options: FetchOptions & { aiEnrichment?: boolean } = {},
  ): Promise<AggregationOutcome[]> {
    const outcomes: AggregationOutcome[] = [];
    for (const provider of providers) {
      try {
        outcomes.push(await this.runProvider(provider, options));
      } catch (error) {
        log.error('provider run failed', {
          provider: provider.descriptor.key,
          error: (error as Error).message,
        });
        outcomes.push({
          provider: provider.descriptor.key,
          fetched: 0, normalized: 0, duplicates: 0, persisted: 0,
          durationMs: 0,
          warnings: [(error as Error).message],
        });
      }
    }
    return outcomes;
  }

  /** Quality floor — keeps obviously broken records out of the index. */
  private isWorthKeeping(item: NormalizedInternship): boolean {
    if (item.title.length < 3 || item.title.length > 300) return false;
    if (!item.applyUrl.startsWith('http')) return false;
    if (item.description.length < 60) return false;
    if (isExpired(item.deadlineAt)) return false;
    return true;
  }
}
