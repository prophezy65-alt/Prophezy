/**
 * lib/opportunities/models/opportunity.model.ts
 *
 * The canonical, normalized `Opportunity` entity — what every provider's
 * raw record becomes after `normalize()` + `validate()` + dedup. This is
 * what gets stored in the `opportunities` table, indexed into
 * `search_index`, and served to every downstream consumer (recommendation
 * engines, dashboards, etc.). This module intentionally contains no
 * ranking or recommendation logic — it is shared infrastructure only.
 */

import { CompensationType, ExperienceLevel, OpportunityStatus, OpportunityType, WorkMode } from "./enums";
import { DateRange, ISODateString, Sha256Hex, UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface OpportunityLocation {
  readonly workMode: WorkMode;
  readonly city: string | null;
  readonly region: string | null; // state/province
  readonly country: string | null; // ISO 3166-1 alpha-2 when known, else free text
  readonly timezone: string | null;
}

export interface OpportunityCompensation {
  readonly type: CompensationType;
  readonly amountMin: number | null;
  readonly amountMax: number | null;
  readonly currency: string | null; // ISO 4217, e.g. "USD"
  readonly period: "hourly" | "monthly" | "yearly" | "one_time" | null;
}

export interface OpportunityDates {
  readonly postedAt: ISODateString | null;
  readonly applicationOpensAt: ISODateString | null;
  readonly applicationDeadline: ISODateString | null;
  readonly eventStartsAt: ISODateString | null;
  readonly eventEndsAt: ISODateString | null;
}

export interface OpportunityEligibility {
  readonly experienceLevel: ExperienceLevel;
  readonly educationLevels: readonly string[]; // e.g. ["undergraduate", "graduate"]
  readonly eligibleCountries: readonly string[]; // ISO 3166-1 alpha-2; empty = unrestricted
  readonly minimumAge: number | null;
  readonly requiresStudentStatus: boolean;
  readonly notes: string | null;
}

export interface OpportunityOrganization {
  readonly name: string;
  readonly website: string | null;
  readonly logoUrl: string | null;
}

/** Provenance of one contributing source record, kept for traceability and re-sync/dedup. */
export interface OpportunityProvenance {
  readonly providerId: string;
  readonly externalId: string;
  readonly sourceUrl: string | null;
  readonly rawContentHash: Sha256Hex;
  readonly firstSeenAt: ISODateString;
  readonly lastSeenAt: ISODateString;
}

/**
 * The output of `OpportunityProvider.normalize()` — an `Opportunity`
 * shape that does not yet have a stable engine-assigned `id`, dedup
 * status, or indexing metadata. `sync/` + `validation/` + the dedup
 * pipeline turn zero or more `NormalizedOpportunityDraft`s into a stored
 * `Opportunity`.
 */
export interface NormalizedOpportunityDraft {
  readonly type: OpportunityType;
  readonly title: string;
  readonly description: string;
  readonly organization: OpportunityOrganization;
  readonly location: OpportunityLocation;
  readonly compensation: OpportunityCompensation;
  readonly dates: OpportunityDates;
  readonly eligibility: OpportunityEligibility;
  readonly technologies: readonly string[]; // free-text tech/skill tags, lowercased
  readonly categories: readonly string[]; // free-text category tags, lowercased
  readonly applicationUrl: string;
  readonly provenance: OpportunityProvenance;
}

export interface Opportunity {
  readonly id: UUID;
  readonly type: OpportunityType;
  readonly status: OpportunityStatus;
  readonly title: string;
  readonly description: string;
  readonly organization: OpportunityOrganization;
  readonly location: OpportunityLocation;
  readonly compensation: OpportunityCompensation;
  readonly dates: OpportunityDates;
  readonly eligibility: OpportunityEligibility;
  readonly technologies: readonly string[];
  readonly categories: readonly string[];
  readonly applicationUrl: string;
  /** Every source record that was merged into this canonical opportunity via dedup. */
  readonly provenances: readonly OpportunityProvenance[];
  readonly dedupContentHash: Sha256Hex;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/** Lightweight projection used in search results / list views. */
export interface OpportunitySummary {
  readonly id: UUID;
  readonly type: OpportunityType;
  readonly status: OpportunityStatus;
  readonly title: string;
  readonly organizationName: string;
  readonly workMode: WorkMode;
  readonly country: string | null;
  readonly applicationDeadline: ISODateString | null;
  readonly technologies: readonly string[];
}

export function toOpportunitySummary(opportunity: Opportunity): OpportunitySummary {
  return {
    id: opportunity.id,
    type: opportunity.type,
    status: opportunity.status,
    title: opportunity.title,
    organizationName: opportunity.organization.name,
    workMode: opportunity.location.workMode,
    country: opportunity.location.country,
    applicationDeadline: opportunity.dates.applicationDeadline,
    technologies: opportunity.technologies,
  };
}

export function isOpportunityExpired(opportunity: Opportunity, asOfISO: ISODateString): boolean {
  const deadline = opportunity.dates.applicationDeadline;
  if (!deadline) return false;
  return Date.parse(deadline) < Date.parse(asOfISO);
}

export function getEffectiveDateRange(opportunity: Opportunity): DateRange {
  return {
    from: opportunity.dates.applicationOpensAt ?? opportunity.dates.postedAt,
    to: opportunity.dates.applicationDeadline ?? opportunity.dates.eventEndsAt,
  };
}

/**
 * Validates internal consistency of an `Opportunity`: required fields are
 * present, date ordering makes sense, compensation ranges are sane, and
 * every provenance entry is well-formed. This is a structural guard, not
 * the full business-rule validation layer (see `validation/`).
 */
export function validateOpportunity(opportunity: Opportunity): string[] {
  const problems: string[] = [];

  if (!isUUID(opportunity.id)) problems.push("Opportunity.id must be a UUID.");
  if (!isNonEmptyString(opportunity.title)) problems.push("Opportunity.title is required.");
  if (!isNonEmptyString(opportunity.description)) problems.push("Opportunity.description is required.");
  if (!isNonEmptyString(opportunity.organization.name)) problems.push("Opportunity.organization.name is required.");
  if (!isNonEmptyString(opportunity.applicationUrl)) problems.push("Opportunity.applicationUrl is required.");
  if (opportunity.provenances.length === 0) problems.push("Opportunity.provenances must contain at least one entry.");

  const { dates } = opportunity;
  if (dates.applicationOpensAt && dates.applicationDeadline) {
    if (Date.parse(dates.applicationOpensAt) > Date.parse(dates.applicationDeadline)) {
      problems.push("Opportunity.dates.applicationOpensAt must be before applicationDeadline.");
    }
  }
  if (dates.eventStartsAt && dates.eventEndsAt) {
    if (Date.parse(dates.eventStartsAt) > Date.parse(dates.eventEndsAt)) {
      problems.push("Opportunity.dates.eventStartsAt must be before eventEndsAt.");
    }
  }

  const comp = opportunity.compensation;
  if (comp.amountMin !== null && comp.amountMax !== null && comp.amountMin > comp.amountMax) {
    problems.push("Opportunity.compensation.amountMin must be <= amountMax.");
  }
  if ((comp.amountMin !== null || comp.amountMax !== null) && comp.type === "unspecified") {
    problems.push("Opportunity.compensation has amount values but type is unspecified.");
  }

  for (const [index, provenance] of opportunity.provenances.entries()) {
    if (!isNonEmptyString(provenance.providerId)) problems.push(`provenances[${index}].providerId is required.`);
    if (!isNonEmptyString(provenance.externalId)) problems.push(`provenances[${index}].externalId is required.`);
    if (Date.parse(provenance.firstSeenAt) > Date.parse(provenance.lastSeenAt)) {
      problems.push(`provenances[${index}]: firstSeenAt must be before or equal to lastSeenAt.`);
    }
  }

  if (opportunity.eligibility.minimumAge !== null && opportunity.eligibility.minimumAge < 0) {
    problems.push("Opportunity.eligibility.minimumAge must be non-negative.");
  }

  return problems;
}

export function validateNormalizedOpportunityDraft(draft: NormalizedOpportunityDraft): string[] {
  const problems: string[] = [];
  if (!isNonEmptyString(draft.title)) problems.push("NormalizedOpportunityDraft.title is required.");
  if (!isNonEmptyString(draft.applicationUrl)) problems.push("NormalizedOpportunityDraft.applicationUrl is required.");
  if (!isNonEmptyString(draft.organization.name)) problems.push("NormalizedOpportunityDraft.organization.name is required.");
  if (!isNonEmptyString(draft.provenance.providerId)) problems.push("NormalizedOpportunityDraft.provenance.providerId is required.");
  if (!isNonEmptyString(draft.provenance.externalId)) problems.push("NormalizedOpportunityDraft.provenance.externalId is required.");
  try {
    // eslint-disable-next-line no-new
    new URL(draft.applicationUrl);
  } catch {
    problems.push(`NormalizedOpportunityDraft.applicationUrl "${draft.applicationUrl}" is not a valid URL.`);
  }
  return problems;
}
