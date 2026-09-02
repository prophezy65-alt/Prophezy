/**
 * provider.service.ts
 * Orchestrates syncing hackathons from every registered source adapter
 * into the HackathonRepository. Designed to run as a background job
 * (via JobQueueProvider / GitHub Actions cron), not on the request path.
 */

import { HackathonSourceId, ServiceResult, success, failure } from "../models/hackathon.model";
import { SourceRegistry } from "../providers/sources/source-registry";
import { SourceNotImplementedError } from "../providers/sources/source-adapter.interface";
import { HackathonService } from "./hackathon.service";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export interface SourceSyncResult {
  sourceId: HackathonSourceId;
  displayName: string;
  ok: boolean;
  fetchedCount: number;
  error?: string;
}

export class ProviderService {
  constructor(
    private readonly registry: SourceRegistry,
    private readonly hackathonService: HackathonService
  ) {}

  /**
   * Syncs a single source: fetches, then upserts into the repository.
   * Never throws — a failed source sync is reported in the result so a
   * batch sync across all sources doesn't abort on the first failure.
   */
  async syncSource(sourceId: HackathonSourceId): Promise<SourceSyncResult> {
    const adapter = this.registry.get(sourceId);
    if (!adapter) {
      return { sourceId, displayName: sourceId, ok: false, fetchedCount: 0, error: "Source not registered." };
    }

    try {
      const result = await withRetry(() => adapter.fetchHackathons({ limit: 50 }), {
        maxAttempts: 2,
        shouldRetry: (err) => !(err instanceof SourceNotImplementedError),
      });

      await this.hackathonService.upsertManyValidated(result.hackathons);

      logger.info("Source sync completed", { sourceId, fetchedCount: result.fetchedCount });
      return { sourceId, displayName: adapter.displayName, ok: true, fetchedCount: result.fetchedCount };
    } catch (error) {
      const isNotImplemented = error instanceof SourceNotImplementedError;
      const message = (error as Error).message;

      if (isNotImplemented) {
        logger.debug("Skipped sync for unimplemented source", { sourceId });
      } else {
        logger.error("Source sync failed", { sourceId, error: message });
      }

      return { sourceId, displayName: adapter.displayName, ok: false, fetchedCount: 0, error: message };
    }
  }

  /**
   * Syncs every registered source concurrently. Returns per-source results
   * so a sync dashboard can show which sources succeeded/failed/are not
   * yet implemented.
   */
  async syncAllSources(): Promise<ServiceResult<SourceSyncResult[]>> {
    const results = await Promise.all(this.registry.list().map((adapter) => this.syncSource(adapter.sourceId)));
    return success(results);
  }
}
