/**
 * lib/hackathons/engine/db/hackathon-sync.repository.ts
 *
 * Mirrors lib/internships/db/repositories/sync.repository.ts exactly, and
 * reuses its getServiceClient() + EngineError DIRECTLY (not reimplemented)
 * — a sync job runs outside any user session, so it needs the same
 * service-role client the internship engine's own jobs use.
 *
 * Tables are namespaced (hackathon_providers, hackathon_sync_logs) rather
 * than the internship engine's bare `providers`/`sync_logs` — those names
 * are already taken by the internship engine's own tables in the same
 * Postgres schema; reusing them here would silently corrupt or collide
 * with internship sync history.
 */

import { getServiceClient } from "../../../internships/db/client";
import { EngineError } from "../../../internships/utils/errors";
import type { HackathonSourceId } from "../../models/hackathon.model";
import type { ProviderHealth, SyncRunResult } from "../types";

export interface HackathonSyncLogEntry extends SyncRunResult {
  runId: string;
}

export class HackathonSyncRepository {
  private get db() {
    return getServiceClient();
  }

  async recordRun(entry: HackathonSyncLogEntry): Promise<void> {
    const { error } = await this.db.from("hackathon_sync_logs").insert({
      provider: entry.provider,
      run_id: entry.runId,
      status: entry.status,
      fetched: entry.fetched,
      normalized: entry.normalized,
      duplicates: entry.duplicates,
      inserted: entry.inserted,
      updated: entry.updated,
      duration_ms: entry.durationMs,
      error: entry.error ?? null,
      warnings: entry.warnings,
      started_at: entry.startedAt,
      finished_at: entry.finishedAt,
    });
    if (error) throw new EngineError("DB_WRITE_FAILED", error.message);
  }

  /** Timestamp of the last successful run for a provider — powers incremental sync. */
  async lastSuccessfulSync(provider: HackathonSourceId): Promise<string | null> {
    const { data, error } = await this.db
      .from("hackathon_sync_logs")
      .select("finished_at")
      .eq("provider", provider)
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new EngineError("DB_READ_FAILED", error.message);
    return (data as { finished_at: string | null } | null)?.finished_at ?? null;
  }

  async upsertProviderHealth(health: ProviderHealth, consecutiveFailures: number, isImplemented: boolean, displayName: string): Promise<void> {
    const { error } = await this.db.from("hackathon_providers").upsert(
      {
        source_id: health.key,
        display_name: displayName,
        is_implemented: isImplemented,
        last_synced_at: health.checkedAt,
        last_sync_ok: health.reachable,
        last_sync_error: health.message ?? null,
      },
      { onConflict: "source_id" }
    );
    if (error) throw new EngineError("DB_WRITE_FAILED", error.message);

    // consecutive_failures / reachable / latency_ms are additive columns
    // (0038_hackathon_sync_engine.sql) not present on the original
    // hackathon_providers row shape — updated separately so a partial
    // schema (migration not yet applied) still lets the first upsert above
    // succeed rather than failing the whole health check.
    await this.db
      .from("hackathon_providers")
      .update({ consecutive_failures: consecutiveFailures, reachable: health.reachable, latency_ms: health.latencyMs ?? null })
      .eq("source_id", health.key);
  }

  async getProviderState(key: HackathonSourceId): Promise<{ consecutiveFailures: number } | null> {
    const { data, error } = await this.db.from("hackathon_providers").select("consecutive_failures").eq("source_id", key).maybeSingle();
    if (error) throw new EngineError("DB_READ_FAILED", error.message);
    if (!data) return null;
    return { consecutiveFailures: Number((data as { consecutive_failures: number | null }).consecutive_failures ?? 0) };
  }

  async recentRuns(limit = 50): Promise<HackathonSyncLogEntry[]> {
    const { data, error } = await this.db.from("hackathon_sync_logs").select("*").order("started_at", { ascending: false }).limit(limit);
    if (error) throw new EngineError("DB_READ_FAILED", error.message);

    return (data as Array<Record<string, unknown>>).map((row) => ({
      provider: row.provider as HackathonSourceId,
      runId: row.run_id as string,
      status: row.status as SyncRunResult["status"],
      fetched: Number(row.fetched ?? 0),
      normalized: Number(row.normalized ?? 0),
      duplicates: Number(row.duplicates ?? 0),
      inserted: Number(row.inserted ?? 0),
      updated: Number(row.updated ?? 0),
      durationMs: Number(row.duration_ms ?? 0),
      error: (row.error as string | null) ?? undefined,
      warnings: (row.warnings as string[]) ?? [],
      startedAt: row.started_at as string,
      finishedAt: (row.finished_at as string | null) ?? "",
    }));
  }

  /**
   * Deletes hackathons whose submission deadline passed more than
   * `retentionDays` ago. Hackathon has no isActive flag to soft-deactivate
   * (unlike NormalizedInternship), so "expiry" here means deletion, gated
   * by a configurable retention window per the spec's own requirement
   * ("delete expired hackathons only after configurable retention").
   */
  async deleteExpired(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const { data, error } = await this.db
      .from("hackathons")
      .delete()
      .lt("timeline->>submissionDeadline", cutoff)
      .select("id");
    if (error) throw new EngineError("DB_WRITE_FAILED", error.message);
    return (data ?? []).length;
  }
}
