/**
 * lib/hackathons/engine/jobs/sync.job.ts
 *
 * Entry point a scheduler (cron, GitHub Actions, or the admin-gated
 * /api/hackathons/sync route) calls. Mirrors
 * lib/internships/jobs/sync.job.ts's composition exactly: wire real
 * repositories against the service-role client, build every registered
 * provider, run the sync, return the summary.
 */

import { getServiceClient } from "../../../internships/db/client";
import { SupabaseHackathonRepository } from "../../providers/hackathon.repository.supabase";
import { HackathonAggregatorService } from "../services/aggregator.service";
import { HackathonSyncService, type SyncOptions } from "../services/sync.service";
import { HackathonSyncRepository } from "../db/hackathon-sync.repository";
import { createAllProviders, getImplementedProviders, PROVIDER_REGISTRY } from "../providers/provider-registry";
import { createLogger } from "../../../internships/utils/logger";
import type { SyncSummary } from "../types";

const log = createLogger("hackathons.sync-job");

export interface RunHackathonSyncOptions {
  mode?: "incremental" | "full";
  /** Sync only these source ids instead of every implemented provider. */
  only?: string[];
  retentionDays?: number;
}

/**
 * Runs a full sync across every implemented provider (Devpost, GitHub
 * Events today — see provider-registry.ts). Not-implemented sources are
 * skipped automatically (HackathonAggregatorService#runProvider reports
 * them as status: "skipped", not an error) rather than needing to be
 * filtered out here.
 */
export async function runHackathonSync(options: RunHackathonSyncOptions = {}): Promise<SyncSummary> {
  const client = getServiceClient();
  const repo = new SupabaseHackathonRepository(client);
  const aggregator = new HackathonAggregatorService(repo);
  const syncService = new HackathonSyncService(aggregator, new HackathonSyncRepository());

  const candidates = getImplementedProviders();
  const filtered = options.only?.length ? candidates.filter((d) => options.only!.includes(d.key)) : candidates;
  const providers = filtered.map((d) => d.factory());

  const syncOptions: SyncOptions = {
    mode: options.mode ?? "incremental",
    providers,
    retentionDays: options.retentionDays,
  };

  log.info("hackathon sync job starting", { mode: syncOptions.mode, providers: providers.map((p) => p.key) });
  const summary = await syncService.run(syncOptions);
  log.info("hackathon sync job finished", {
    runId: summary.runId,
    totalInserted: summary.totalInserted,
    totalUpdated: summary.totalUpdated,
    totalFailed: summary.totalFailed,
  });
  return summary;
}

/** Health check across EVERY registered provider (implemented + stub) — stubs report status "unsupported", not "down". */
export async function runHackathonHealthCheck() {
  const providers = createAllProviders();
  const client = getServiceClient();
  const repo = new SupabaseHackathonRepository(client);
  const aggregator = new HackathonAggregatorService(repo);
  const syncService = new HackathonSyncService(aggregator, new HackathonSyncRepository());

  return syncService.checkAllHealth(providers);
}

export function listRegisteredSources() {
  return PROVIDER_REGISTRY.map((d) => ({
    key: d.key,
    displayName: d.displayName,
    isImplemented: d.isImplemented,
    accessBasis: d.accessBasis,
    integrationNote: d.integrationNote,
  }));
}
