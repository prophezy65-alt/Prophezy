/**
 * lib/hackathons/engine/services/aggregator.service.ts
 *
 * Mirrors lib/internships/services/aggregator.service.ts exactly:
 * provider -> normalize -> dedupe -> persist, isolated from SyncService so
 * it can also be invoked ad hoc (admin "resync this provider now",
 * scripts, tests). Persistence reuses the EXISTING
 * SupabaseHackathonRepository.upsertMany() from
 * providers/hackathon.repository.supabase.ts — not a new repository.
 */

import type { Hackathon, HackathonSourceId } from "../../models/hackathon.model";
import type { HackathonProvider, SyncRunResult } from "../types";
import { HackathonNormalizerService } from "./normalizer.service";
import { HackathonDeduplicationService } from "./deduplication.service";
import type { SupabaseHackathonRepository } from "../../providers/hackathon.repository.supabase";
import { createLogger } from "../../../internships/utils/logger";

const log = createLogger("hackathons.aggregator");

/** Quality floor — keeps obviously broken records out of the catalog, mirroring the internship engine's isWorthKeeping(). */
function isWorthKeeping(h: Hackathon): boolean {
  if (h.title.trim().length < 3 || h.title.length > 300) return false;
  if (!h.sourceUrl.startsWith("http")) return false;
  if (!h.timeline.submissionDeadline) return false;
  return true;
}

export class HackathonAggregatorService {
  constructor(
    private readonly repo: SupabaseHackathonRepository,
    private readonly normalizer = new HackathonNormalizerService(),
    private readonly deduplication = new HackathonDeduplicationService(),
    private readonly aiEnrichment = false // off by default — see normalizer.service.ts's doc comment on AI spend at scale
  ) {}

  async runProvider(provider: HackathonProvider, options: { since?: string; limit?: number } = {}): Promise<SyncRunResult> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const key: HackathonSourceId = provider.key;

    if (!provider.isImplemented) {
      return this.skippedResult(key, startedAt, "Provider not implemented — see provider-registry.ts's integrationNote.");
    }

    try {
      const fetchResult = await provider.fetchAll(options);
      log.info("provider fetch complete", { provider: key, fetched: fetchResult.fetchedCount });

      const kept = fetchResult.hackathons.filter(isWorthKeeping);

      const normalized: Hackathon[] = [];
      for (const item of kept) {
        const deterministic = this.normalizer.normalizeDeterministic(item);
        normalized.push(
          this.aiEnrichment && this.normalizer.needsAiEnrichment(deterministic)
            ? await this.normalizer.enrichWithAi(deterministic)
            : deterministic
        );
      }

      const { merged, duplicatesRemoved } = this.deduplication.dedupe(normalized);
      const persisted = await this.repo.upsertMany(merged);

      return {
        provider: key,
        status: fetchResult.warnings.length > 0 ? "partial" : "success",
        fetched: fetchResult.fetchedCount,
        normalized: normalized.length,
        duplicates: duplicatesRemoved,
        inserted: persisted.length, // upsertMany doesn't distinguish insert vs update — see SyncRepository note
        updated: 0,
        durationMs: Date.now() - startMs,
        warnings: fetchResult.warnings,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    } catch (error) {
      log.error("provider run failed", { provider: key, error: error instanceof Error ? error.message : String(error) });
      return {
        provider: key,
        status: "failed",
        fetched: 0,
        normalized: 0,
        duplicates: 0,
        inserted: 0,
        updated: 0,
        durationMs: Date.now() - startMs,
        error: error instanceof Error ? error.message : String(error),
        warnings: [],
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
  }

  async runMany(providers: readonly HackathonProvider[], options: { since?: string; limit?: number } = {}): Promise<SyncRunResult[]> {
    const results: SyncRunResult[] = [];
    for (const provider of providers) {
      results.push(await this.runProvider(provider, options));
    }
    return results;
  }

  private skippedResult(provider: HackathonSourceId, startedAt: string, reason: string): SyncRunResult {
    return {
      provider,
      status: "skipped",
      fetched: 0,
      normalized: 0,
      duplicates: 0,
      inserted: 0,
      updated: 0,
      durationMs: 0,
      error: reason,
      warnings: [],
      startedAt,
      finishedAt: startedAt,
    };
  }
}
