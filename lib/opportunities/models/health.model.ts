/**
 * lib/opportunities/models/health.model.ts
 *
 * Backs the `provider_health` table: the current rolling health snapshot
 * for each provider, used by the registry to skip/deprioritize unhealthy
 * providers and by dashboards to surface "which sources are broken."
 */

import { ProviderHealthState } from "./enums";
import { ISODateString, isNonEmptyString } from "./shared.model";

export interface ProviderHealthSnapshot {
  readonly providerId: string;
  readonly state: ProviderHealthState;
  /** Rolling window over the last N syncs (window size is a services/-layer concern; this model just stores the result). */
  readonly rollingSuccessRate: number; // 0-1
  readonly averageLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly consecutiveFailureCount: number;
  readonly lastSuccessfulSyncAt: ISODateString | null;
  readonly lastFailedSyncAt: ISODateString | null;
  readonly lastCheckedAt: ISODateString;
  readonly lastErrorMessage: string | null;
}

const DEGRADED_SUCCESS_RATE_THRESHOLD = 0.8;
const DOWN_SUCCESS_RATE_THRESHOLD = 0.3;
const DOWN_CONSECUTIVE_FAILURE_THRESHOLD = 5;

/**
 * Derives a `ProviderHealthState` from raw metrics. Centralizing this
 * computation here (rather than duplicating the thresholds in every
 * caller) keeps "what counts as degraded vs. down" consistent across the
 * registry, dashboards, and alerting.
 */
export function deriveHealthState(input: {
  readonly rollingSuccessRate: number;
  readonly consecutiveFailureCount: number;
}): ProviderHealthState {
  if (input.consecutiveFailureCount >= DOWN_CONSECUTIVE_FAILURE_THRESHOLD) return ProviderHealthState.DOWN;
  if (input.rollingSuccessRate <= DOWN_SUCCESS_RATE_THRESHOLD) return ProviderHealthState.DOWN;
  if (input.rollingSuccessRate <= DEGRADED_SUCCESS_RATE_THRESHOLD) return ProviderHealthState.DEGRADED;
  return ProviderHealthState.HEALTHY;
}

export function isProviderUsable(snapshot: ProviderHealthSnapshot): boolean {
  return snapshot.state !== ProviderHealthState.DOWN;
}

export function shouldAlert(snapshot: ProviderHealthSnapshot): boolean {
  return snapshot.state === ProviderHealthState.DOWN || snapshot.consecutiveFailureCount >= DOWN_CONSECUTIVE_FAILURE_THRESHOLD;
}

export function validateProviderHealthSnapshot(snapshot: ProviderHealthSnapshot): string[] {
  const problems: string[] = [];

  if (!isNonEmptyString(snapshot.providerId)) problems.push("ProviderHealthSnapshot.providerId is required.");
  if (snapshot.rollingSuccessRate < 0 || snapshot.rollingSuccessRate > 1) {
    problems.push("ProviderHealthSnapshot.rollingSuccessRate must be within 0-1.");
  }
  if (snapshot.averageLatencyMs < 0) problems.push("ProviderHealthSnapshot.averageLatencyMs must be non-negative.");
  if (snapshot.p95LatencyMs < snapshot.averageLatencyMs) {
    problems.push("ProviderHealthSnapshot.p95LatencyMs should not be less than averageLatencyMs.");
  }
  if (snapshot.consecutiveFailureCount < 0) problems.push("ProviderHealthSnapshot.consecutiveFailureCount must be non-negative.");

  const expectedState = deriveHealthState(snapshot);
  if (snapshot.state !== expectedState && snapshot.state !== ProviderHealthState.UNKNOWN) {
    problems.push(
      `ProviderHealthSnapshot.state is "${snapshot.state}" but metrics imply "${expectedState}" — recompute via deriveHealthState().`
    );
  }

  return problems;
}
