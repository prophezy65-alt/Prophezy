import type {
  ApplicationRecord,
  InternshipRecord,
  NormalizedInternship,
  NotificationRecord,
} from '../types';

/**
 * Public-facing shape for any browsing/listing/detail response — every
 * field of InternshipRecord EXCEPT applyUrl. The real application link is
 * gated behind unlockInternshipApplication() (application-unlock.service.ts)
 * and must never come back from a plain search/list/detail/recommendation/
 * saved/recently-viewed fetch (Phase 5 fix — this was previously leaking
 * unconditionally, which made the entire credit/unlock gate moot regardless
 * of any server-side counter logic). Apply this at every API route that
 * serializes an internship (or array of internships) to the client.
 */
export type PublicInternship = Omit<InternshipRecord, 'applyUrl'>;

export function toPublicInternship(internship: InternshipRecord): PublicInternship {
  const { applyUrl: _applyUrl, ...rest } = internship;
  return rest;
}

export function toPublicInternships(internships: InternshipRecord[]): PublicInternship[] {
  return internships.map(toPublicInternship);
}

/** Row shapes as returned by PostgREST (snake_case). */
export interface InternshipRow {
  id: string;
  fingerprint: string;
  title: string;
  normalized_title: string;
  company_id: string | null;
  company_name: string;
  company_slug: string;
  company_website: string | null;
  company_logo_url: string | null;
  company_domain: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  location_raw: string | null;
  work_mode: string;
  employment_type: string;
  stipend_min: number | null;
  stipend_max: number | null;
  stipend_currency: string | null;
  stipend_period: string | null;
  is_unpaid: boolean;
  stipend_monthly_inr: number | null;
  stipend_raw: string | null;
  duration_months: number | null;
  duration_raw: string | null;
  skills: string[] | null;
  degrees: string[] | null;
  branches: string[] | null;
  eligible_years: number[] | null;
  min_cgpa: number | null;
  eligibility_notes: string[] | null;
  description: string;
  description_html: string | null;
  apply_url: string;
  posted_at: string | null;
  deadline_at: string | null;
  tags: string[] | null;
  sources: unknown;
  source_confidence: number;
  is_active: boolean;
  view_count: number;
  apply_count: number;
  quality_score: number;
  embedding: number[] | string | null;
  created_at: string;
  updated_at: string;
}

export function rowToInternship(row: InternshipRow): InternshipRecord {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    title: row.title,
    normalizedTitle: row.normalized_title,
    company: {
      name: row.company_name,
      slug: row.company_slug,
      website: row.company_website,
      logoUrl: row.company_logo_url,
      domain: row.company_domain,
    },
    companyId: row.company_id,
    location: { city: row.city, state: row.state, country: row.country, raw: row.location_raw },
    workMode: row.work_mode as InternshipRecord['workMode'],
    employmentType: row.employment_type as InternshipRecord['employmentType'],
    compensation: {
      min: row.stipend_min,
      max: row.stipend_max,
      currency: row.stipend_currency as InternshipRecord['compensation']['currency'],
      period: row.stipend_period as InternshipRecord['compensation']['period'],
      isUnpaid: row.is_unpaid,
      normalizedMonthlyInr: row.stipend_monthly_inr,
      raw: row.stipend_raw,
    },
    duration: { months: row.duration_months, raw: row.duration_raw },
    skills: row.skills ?? [],
    eligibility: {
      degrees: row.degrees ?? [],
      branches: row.branches ?? [],
      years: row.eligible_years ?? [],
      minCgpa: row.min_cgpa,
      notes: row.eligibility_notes ?? [],
    },
    description: row.description,
    descriptionHtml: row.description_html,
    applyUrl: row.apply_url,
    postedAt: row.posted_at,
    deadlineAt: row.deadline_at,
    tags: row.tags ?? [],
    sources: Array.isArray(row.sources) ? (row.sources as InternshipRecord['sources']) : [],
    sourceConfidence: row.source_confidence,
    isActive: row.is_active,
    viewCount: row.view_count,
    applyCount: row.apply_count,
    qualityScore: row.quality_score,
    embedding: parseEmbedding(row.embedding),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function internshipToRow(item: NormalizedInternship, qualityScore: number): Omit<InternshipRow,
  'id' | 'company_id' | 'is_active' | 'view_count' | 'apply_count' | 'embedding' | 'created_at' | 'updated_at'> {
  return {
    fingerprint: item.fingerprint,
    title: item.title,
    normalized_title: item.normalizedTitle,
    company_name: item.company.name,
    company_slug: item.company.slug,
    company_website: item.company.website,
    company_logo_url: item.company.logoUrl,
    company_domain: item.company.domain,
    city: item.location.city,
    state: item.location.state,
    country: item.location.country,
    location_raw: item.location.raw,
    work_mode: item.workMode,
    employment_type: item.employmentType,
    stipend_min: item.compensation.min,
    stipend_max: item.compensation.max,
    stipend_currency: item.compensation.currency,
    stipend_period: item.compensation.period,
    is_unpaid: item.compensation.isUnpaid,
    stipend_monthly_inr: item.compensation.normalizedMonthlyInr,
    stipend_raw: item.compensation.raw,
    duration_months: item.duration.months,
    duration_raw: item.duration.raw,
    skills: item.skills,
    degrees: item.eligibility.degrees,
    branches: item.eligibility.branches,
    eligible_years: item.eligibility.years,
    min_cgpa: item.eligibility.minCgpa,
    eligibility_notes: item.eligibility.notes,
    description: item.description,
    description_html: item.descriptionHtml,
    apply_url: item.applyUrl,
    posted_at: item.postedAt,
    deadline_at: item.deadlineAt,
    tags: item.tags,
    sources: item.sources,
    source_confidence: item.sourceConfidence,
    quality_score: qualityScore,
  };
}

export interface ApplicationRow {
  id: string;
  user_id: string;
  internship_id: string;
  status: string;
  applied_at: string | null;
  interview_at: string | null;
  decision_at: string | null;
  deadline_at: string | null;
  notes: string | null;
  documents: unknown;
  created_at: string;
  updated_at: string;
}

export function rowToApplication(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    internshipId: row.internship_id,
    status: row.status as ApplicationRecord['status'],
    appliedAt: row.applied_at,
    interviewAt: row.interview_at,
    decisionAt: row.decision_at,
    deadlineAt: row.deadline_at,
    notes: row.notes,
    documents: Array.isArray(row.documents) ? (row.documents as ApplicationRecord['documents']) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  channel: string;
  payload: unknown;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export function rowToNotification(row: NotificationRow): NotificationRecord {
  const payload = (row.payload ?? {}) as Partial<NotificationRecord['payload']>;
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as NotificationRecord['kind'],
    channel: row.channel as NotificationRecord['channel'],
    payload: {
      title: payload.title ?? '',
      body: payload.body ?? '',
      url: payload.url ?? null,
      internshipIds: payload.internshipIds ?? [],
      meta: payload.meta ?? {},
    },
    readAt: row.read_at,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function parseEmbedding(value: number[] | string | null): number[] | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}
