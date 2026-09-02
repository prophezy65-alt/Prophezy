/**
 * lib/opportunities/models/sync.model.ts
 *
 * Backs the `provider_sync` table: the history of every sync run per
 * provider, plus the incremental-sync cursor and background scheduling
 * configuration used to decide when a provider's next sync should run.
 */

import { SyncStatus, SyncTrigger } from "./enums";
import { ISODateString, UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface SyncRun {
  readonly id: UUID;
  readonly providerId: string;
  readonly trigger: SyncTrigger;
  readonly status: SyncStatus;
  readonly startedAt: ISODateString;
  readonly finishedAt: ISODateString | null;
  readonly cursorAtStart: string | null;
  readonly cursorAtEnd: string | null;
  readonly itemsFetched: number;
  readonly itemsCreated: number;
  readonly itemsUpdated: number;
  readonly itemsSkipped: number;
  readonly itemsFailed: number;
  readonly errorSummaries: readonly string[];
}

export function durationMs(run: SyncRun): number | null {
  if (!run.finishedAt) return null;
  return Date.parse(run.finishedAt) - Date.parse(run.startedAt);
}

export function isTerminal(status: SyncStatus): boolean {
  return status === SyncStatus.SUCCEEDED || status === SyncStatus.PARTIALLY_SUCCEEDED || status === SyncStatus.FAILED;
}

export function successRate(run: SyncRun): number {
  if (run.itemsFetched === 0) return 1;
  return (run.itemsCreated + run.itemsUpdated + run.itemsSkipped) / run.itemsFetched;
}

/** Per-provider background scheduling state — when it last ran and when it's due again. */
export interface ProviderScheduleState {
  readonly providerId: string;
  readonly syncIntervalMinutes: number;
  readonly lastSyncStartedAt: ISODateString | null;
  readonly lastSuccessfulSyncAt: ISODateString | null;
  readonly nextEligibleSyncAt: ISODateString;
  readonly consecutiveFailureCount: number;
  /** Exponential backoff pushes this out further after repeated failures, independent of the base interval. */
  readonly backoffUntil: ISODateString | null;
}

export function isDueForSync(state: ProviderScheduleState, nowISO: ISODateString): boolean {
  const now = Date.parse(nowISO);
  if (state.backoffUntil && now < Date.parse(state.backoffUntil)) return false;
  return now >= Date.parse(state.nextEligibleSyncAt);
}

export function computeNextEligibleSyncAt(intervalMinutes: number, fromISO: ISODateString): ISODateString {
  return new Date(Date.parse(fromISO) + intervalMinutes * 60_000).toISOString();
}

/** Exponential backoff for a provider that has failed `consecutiveFailureCount` syncs in a row, capped at `maxDelayMinutes`. */
export function computeBackoffUntil(
  consecutiveFailureCount: number,
  fromISO: ISODateString,
  baseDelayMinutes = 5,
  maxDelayMinutes = 24 * 60
): ISODateString {
  const delayMinutes = Math.min(maxDelayMinutes, baseDelayMinutes * 2 ** Math.max(0, consecutiveFailureCount - 1));
  return new Date(Date.parse(fromISO) + delayMinutes * 60_000).toISOString();
}

export function validateSyncRun(run: SyncRun): string[] {
  const problems: string[] = [];

  if (!isUUID(run.id)) problems.push("SyncRun.id must be a UUID.");
  if (!isNonEmptyString(run.providerId)) problems.push("SyncRun.providerId is required.");

  if (run.finishedAt && Date.parse(run.finishedAt) < Date.parse(run.startedAt)) {
    problems.push("SyncRun.finishedAt cannot be before startedAt.");
  }
  if (!isTerminal(run.status) && run.finishedAt !== null) {
    problems.push(`SyncRun.status "${run.status}" is non-terminal but finishedAt is set.`);
  }
  if (isTerminal(run.status) && run.finishedAt === null) {
    problems.push(`SyncRun.status "${run.status}" is terminal but finishedAt is null.`);
  }

  const total = run.itemsCreated + run.itemsUpdated + run.itemsSkipped + run.itemsFailed;
  if (total > run.itemsFetched) {
    problems.push(
      `SyncRun item counts (created+updated+skipped+failed=${total}) exceed itemsFetched (${run.itemsFetched}).`
    );
  }

  if (run.status === SyncStatus.FAILED && run.errorSummaries.length === 0) {
    problems.push('SyncRun.status is "failed" but errorSummaries is empty.');
  }

  for (const [field, value] of Object.entries({
    itemsFetched: run.itemsFetched,
    itemsCreated: run.itemsCreated,
    itemsUpdated: run.itemsUpdated,
    itemsSkipped: run.itemsSkipped,
    itemsFailed: run.itemsFailed,
  })) {
    if (value < 0) problems.push(`SyncRun.${field} must be non-negative.`);
  }

  return problems;
}
