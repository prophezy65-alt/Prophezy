/**
 * lib/opportunities/models/opportunity-source.model.ts
 *
 * Backs the `opportunity_sources` table: one row per raw record ever
 * fetched from a provider, independent of whether it became its own
 * `Opportunity` or was merged into an existing one via dedup. Keeping
 * every source record (not just the merged result) is what makes
 * re-sync, dedup auditing, and "why was this merged" debugging possible.
 */

import { DedupDecision } from "./enums";
import { ISODateString, OpportunityEngineError, Sha256Hex, UUID, isNonEmptyString, isSha256Hex, isUUID } from "./shared.model";

export interface OpportunitySourceRecord {
  readonly id: UUID;
  readonly providerId: string;
  readonly externalId: string;
  readonly rawPayload: Record<string, unknown>;
  readonly rawContentHash: Sha256Hex;
  readonly sourceUrl: string | null;
  /** Null until dedup resolves this source to a canonical opportunity (or discards it). */
  readonly opportunityId: UUID | null;
  readonly dedupDecision: DedupDecision;
  readonly fetchedAt: ISODateString;
  readonly normalizedAt: ISODateString | null;
  readonly dedupResolvedAt: ISODateString | null;
  readonly normalizationError: string | null;
}

/** One candidate considered during dedup, with the similarity signal that drove the decision. */
export interface DedupComparison {
  readonly candidateOpportunityId: UUID;
  readonly similarityScore: number; // 0-1
  readonly matchedOn: readonly ("title" | "organization" | "application_url" | "content_hash" | "date_overlap")[];
}

export interface DedupOutcome {
  readonly sourceId: UUID;
  readonly decision: DedupDecision;
  readonly resolvedOpportunityId: UUID | null;
  readonly comparisons: readonly DedupComparison[];
  readonly reason: string;
}

export function findLatestComparison(outcome: DedupOutcome): DedupComparison | null {
  if (outcome.comparisons.length === 0) return null;
  return [...outcome.comparisons].sort((a, b) => b.similarityScore - a.similarityScore)[0] ?? null;
}

export function validateOpportunitySourceRecord(record: OpportunitySourceRecord): string[] {
  const problems: string[] = [];

  if (!isUUID(record.id)) problems.push("OpportunitySourceRecord.id must be a UUID.");
  if (!isNonEmptyString(record.providerId)) problems.push("OpportunitySourceRecord.providerId is required.");
  if (!isNonEmptyString(record.externalId)) problems.push("OpportunitySourceRecord.externalId is required.");
  if (!isSha256Hex(record.rawContentHash)) problems.push("OpportunitySourceRecord.rawContentHash must be a SHA-256 hex digest.");

  if (record.opportunityId !== null && !isUUID(record.opportunityId)) {
    problems.push("OpportunitySourceRecord.opportunityId must be a UUID when present.");
  }

  const resolvedDecisions: DedupDecision[] = [DedupDecision.DUPLICATE_MERGED, DedupDecision.UNIQUE];
  if (resolvedDecisions.includes(record.dedupDecision) && record.opportunityId === null) {
    problems.push(`OpportunitySourceRecord.dedupDecision is "${record.dedupDecision}" but opportunityId is null.`);
  }
  if (record.dedupDecision === DedupDecision.DUPLICATE_DISCARDED && record.opportunityId !== null) {
    problems.push('OpportunitySourceRecord.dedupDecision is "duplicate_discarded" but opportunityId is set.');
  }

  if (record.normalizedAt && Date.parse(record.normalizedAt) < Date.parse(record.fetchedAt)) {
    problems.push("OpportunitySourceRecord.normalizedAt cannot be before fetchedAt.");
  }
  if (record.dedupResolvedAt && record.normalizedAt && Date.parse(record.dedupResolvedAt) < Date.parse(record.normalizedAt)) {
    problems.push("OpportunitySourceRecord.dedupResolvedAt cannot be before normalizedAt.");
  }

  return problems;
}

export function toEngineError(record: OpportunitySourceRecord): OpportunityEngineError | null {
  if (!record.normalizationError) return null;
  return {
    code: "NORMALIZATION_FAILED",
    message: record.normalizationError,
    providerId: record.providerId,
    retryable: false,
  };
}
