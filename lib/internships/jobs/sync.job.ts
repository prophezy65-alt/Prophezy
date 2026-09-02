import { SyncService, type SyncSummary } from '../services';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.job.sync');

/**
 * Entry point for scheduled synchronization.
 * Invoked by `scripts/run-sync.ts` (GitHub Actions) or a Supabase scheduled function.
 */
export async function runScheduledSync(options: {
  full?: boolean;
  providers?: string[];
  maxItemsPerProvider?: number;
} = {}): Promise<SyncSummary> {
  const sync = new SyncService();
  const summary = await sync.runAll(options);

  log.info('scheduled sync finished', {
    runId: summary.runId,
    providersRun: summary.providersRun,
    providersFailed: summary.providersFailed,
    totalPersisted: summary.totalPersisted,
  });
  return summary;
}

export async function runHealthSweep(): Promise<void> {
  const sync = new SyncService();
  const results = await sync.checkAllHealth();
  const unhealthy = results.filter((r) => !r.reachable && r.status !== 'unsupported');
  if (unhealthy.length > 0) {
    log.warn('providers unhealthy', { providers: unhealthy.map((r) => r.provider) });
  }
}
