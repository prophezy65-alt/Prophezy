/**
 * Canonical internship domain types.
 * Every provider MUST normalize into `NormalizedInternship`.
 */

export type WorkMode = 'remote' | 'hybrid' | 'onsite';

export type EmploymentType =
  | 'internship'
  | 'apprenticeship'
  | 'co_op'
  | 'trainee'
  | 'fellowship'
  | 'part_time'
  | 'full_time'
  | 'contract'
  | 'volunteer';

export type Currency =
  | 'INR' | 'USD' | 'EUR' | 'GBP' | 'SGD' | 'AUD' | 'CAD' | 'AED' | 'JPY' | 'CHF';

export type StipendPeriod = 'hour' | 'day' | 'week' | 'month' | 'year' | 'total';

export interface Compensation {
  /** null => unknown, 0 => explicitly unpaid */
  min: number | null;
  max: number | null;
  currency: Currency | null;
  period: StipendPeriod | null;
  /** true when the posting explicitly states the role is unpaid */
  isUnpaid: boolean;
  /** normalized to INR-per-month for cross-provider comparison; null when unknown */
  normalizedMonthlyInr: number | null;
  raw: string | null;
}

export interface DurationSpec {
  months: number | null;
  raw: string | null;
}

export interface LocationSpec {
  city: string | null;
  state: string | null;
  /** ISO-3166 alpha-2, uppercased */
  country: string | null;
  raw: string | null;
}

export interface EligibilitySpec {
  degrees: string[];
  branches: string[];
  /** graduation years, e.g. [2026, 2027] */
  years: number[];
  minCgpa: number | null;
  /** free-form constraints the AI layer can still reason over */
  notes: string[];
}

export interface CompanyRef {
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  domain: string | null;
}

export interface SourceRef {
  provider: string;
  externalId: string;
  url: string;
  fetchedAt: string;
}

/** The single shape the rest of the engine operates on. */
export interface NormalizedInternship {
  /** deterministic content hash — stable across syncs */
  fingerprint: string;
  title: string;
  normalizedTitle: string;
  company: CompanyRef;
  location: LocationSpec;
  workMode: WorkMode;
  employmentType: EmploymentType;
  compensation: Compensation;
  duration: DurationSpec;
  skills: string[];
  eligibility: EligibilitySpec;
  description: string;
  descriptionHtml: string | null;
  applyUrl: string;
  postedAt: string | null;
  deadlineAt: string | null;
  tags: string[];
  sources: SourceRef[];
  /** provider-reported freshness / quality signal, 0..1 */
  sourceConfidence: number;
}

/** Row shape as persisted (mirrors the `internships` table). */
export interface InternshipRecord extends NormalizedInternship {
  id: string;
  companyId: string | null;
  isActive: boolean;
  viewCount: number;
  applyCount: number;
  qualityScore: number;
  embedding: number[] | null;
  createdAt: string;
  updatedAt: string;
}
