import { getServiceClient } from '../client';
import { EngineError } from '../../utils/errors';
import type { ProviderHealth, ProviderStatus } from '../../types';

export interface SyncLogEntry {
  id?: string;
  provider: string;
  runId: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  fetched: number;
  normalized: number;
  duplicates: number;
  inserted: number;
  updated: number;
  durationMs: number;
  error: string | null;
  warnings: string[];
  startedAt: string;
  finishedAt: string | null;
}

export class SyncRepository {
  private get db() {
    return getServiceClient();
  }

  async recordRun(entry: SyncLogEntry): Promise<void> {
    const { error } = await this.db.from('sync_logs').insert({
      provider: entry.provider,
      run_id: entry.runId,
      status: entry.status,
      fetched: entry.fetched,
      normalized: entry.normalized,
      duplicates: entry.duplicates,
      inserted: entry.inserted,
      updated: entry.updated,
      duration_ms: entry.durationMs,
      error: entry.error,
      warnings: entry.warnings,
      started_at: entry.startedAt,
      finished_at: entry.finishedAt,
    });
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }

  /** Timestamp of the last successful run, used for incremental sync. */
  async lastSuccessfulSync(provider: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('sync_logs')
      .select('finished_at')
      .eq('provider', provider)
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as { finished_at: string | null } | null)?.finished_at ?? null;
  }

  async upsertProviderHealth(health: ProviderHealth, consecutiveFailures: number): Promise<void> {
    const { error } = await this.db.from('providers').upsert(
      {
        key: health.provider,
        status: health.status,
        reachable: health.reachable,
        latency_ms: health.latencyMs,
        message: health.message,
        consecutive_failures: consecutiveFailures,
        checked_at: health.checkedAt,
      },
      { onConflict: 'key' },
    );
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }

  async getProviderState(key: string): Promise<{ status: ProviderStatus; consecutiveFailures: number } | null> {
    const { data, error } = await this.db
      .from('providers')
      .select('status, consecutive_failures')
      .eq('key', key)
      .maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    if (!data) return null;
    const row = data as { status: string; consecutive_failures: number };
    return { status: row.status as ProviderStatus, consecutiveFailures: row.consecutive_failures };
  }

  async recentRuns(limit = 50): Promise<SyncLogEntry[]> {
    const { data, error } = await this.db
      .from('sync_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);

    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      provider: row.provider as string,
      runId: row.run_id as string,
      status: row.status as SyncLogEntry['status'],
      fetched: Number(row.fetched ?? 0),
      normalized: Number(row.normalized ?? 0),
      duplicates: Number(row.duplicates ?? 0),
      inserted: Number(row.inserted ?? 0),
      updated: Number(row.updated ?? 0),
      durationMs: Number(row.duration_ms ?? 0),
      error: (row.error as string | null) ?? null,
      warnings: (row.warnings as string[]) ?? [],
      startedAt: row.started_at as string,
      finishedAt: (row.finished_at as string | null) ?? null,
    }));
  }
}
