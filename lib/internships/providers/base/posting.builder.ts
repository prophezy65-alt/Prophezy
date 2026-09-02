import type {
  Compensation,
  DurationSpec,
  EligibilitySpec,
  EmploymentType,
  LocationSpec,
  NormalizedInternship,
  SourceRef,
  WorkMode,
} from '../../types';
import { EXCLUDED_TITLE_SIGNALS, INTERNSHIP_TITLE_SIGNALS } from '../../config/constants';
import { isoNow, parseDurationMonths } from '../../utils/date';
import { emptyCompensation } from '../../utils/money';
import { detectWorkMode, parseLocation } from '../../utils/location';
import { extractSkills } from '../../utils/skills';
import { collapseWhitespace, normalizeTitle, sha256, slugify, stripHtml, truncate } from '../../utils/text';

export interface RawPosting {
  provider: string;
  externalId: string;
  title: string;
  companyName: string;
  companyWebsite?: string | null;
  companyLogo?: string | null;
  locationRaw?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  applyUrl: string;
  postedAt?: string | null;
  deadlineAt?: string | null;
  compensation?: Compensation | null;
  durationRaw?: string | null;
  tags?: string[];
  workModeHint?: WorkMode | null;
  employmentTypeHint?: EmploymentType | null;
  confidence?: number;
}

const EMPTY_ELIGIBILITY: EligibilitySpec = {
  degrees: [], branches: [], years: [], minCgpa: null, notes: [],
};

/** True when a posting plausibly targets students/early-career candidates. */
export function looksLikeInternship(title: string, description = ''): boolean {
  const haystack = `${title} ${description.slice(0, 1_200)}`.toLowerCase();
  const positive = INTERNSHIP_TITLE_SIGNALS.some((signal) => haystack.includes(signal));
  if (!positive) return false;
  const titleLower = ` ${title.toLowerCase()} `;
  const negative = EXCLUDED_TITLE_SIGNALS.some((signal) => titleLower.includes(signal));
  return !negative;
}

/**
 * Infers EmploymentType from title/description when a provider doesn't tell
 * us directly. Previously this fell back to a hardcoded 'internship' for
 * EVERY posting from every provider that never sets employmentTypeHint
 * (which, as of this codebase, is all of them — Greenhouse, Adzuna, Jooble,
 * etc. never set it) — meaning genuinely full-time roles were being tagged
 * as internships across the board, which is exactly why the "Jobs" category
 * filter kept surfacing internships: it was filtering correctly against
 * data that was wrong at the source. This checks the same kind of title/
 * description signals `looksLikeInternship` already uses, but produces a
 * real EmploymentType instead of a boolean, and defaults to 'full_time'
 * (not 'internship') when nothing matches — full-time is the far more
 * common case across a general job/aggregator feed.
 */
function inferEmploymentType(title: string, description: string): EmploymentType {
  const haystack = `${title} ${description.slice(0, 800)}`.toLowerCase();

  if (/\bco[-\s]?op\b/.test(haystack)) return 'co_op';
  if (/\bapprentice(ship)?\b/.test(haystack)) return 'apprenticeship';
  if (/\bfellow(ship)?\b/.test(haystack)) return 'fellowship';
  if (/\btrainee(ship)?\b/.test(haystack)) return 'trainee';
  if (looksLikeInternship(title, description)) return 'internship';
  if (/\bpart[-\s]?time\b/.test(haystack)) return 'part_time';
  if (/\b(contract|contractor|freelance|temporary|temp\b)\b/.test(haystack)) return 'contract';
  if (/\bvolunteer\b/.test(haystack)) return 'volunteer';
  return 'full_time';
}

/**
 * Deterministic fingerprint. Two postings for the same role at the same company
 * and location collapse to one hash regardless of which provider surfaced them.
 */
export function fingerprintOf(companySlug: string, normalizedTitle: string, location: LocationSpec): string {
  const locationKey = [location.city, location.country].filter(Boolean).join('|').toLowerCase();
  return sha256(`${companySlug}::${normalizedTitle}::${locationKey}`).slice(0, 40);
}

/** Converts a provider's raw payload into the canonical shape. Pure and synchronous. */
export function buildPosting(raw: RawPosting): NormalizedInternship {
  const title = collapseWhitespace(raw.title);
  const companyName = collapseWhitespace(raw.companyName) || 'Unknown company';
  const companySlug = slugify(companyName);

  const descriptionHtml = raw.descriptionHtml ?? null;
  const description = truncate(
    collapseWhitespace(raw.descriptionText ?? (descriptionHtml ? stripHtml(descriptionHtml) : '')),
    12_000,
  );

  const location: LocationSpec = parseLocation(raw.locationRaw);
  const workMode: WorkMode =
    raw.workModeHint ?? detectWorkMode(title, raw.locationRaw, description.slice(0, 800));

  const durationRaw = raw.durationRaw ?? null;
  const duration: DurationSpec = {
    months: parseDurationMonths(durationRaw ?? description.slice(0, 2_000)),
    raw: durationRaw,
  };

  const domain = raw.companyWebsite ? safeDomain(raw.companyWebsite) : null;

  return {
    fingerprint: fingerprintOf(companySlug, normalizeTitle(title), location),
    title,
    normalizedTitle: normalizeTitle(title),
    company: {
      name: companyName,
      slug: companySlug,
      website: raw.companyWebsite ?? null,
      logoUrl: raw.companyLogo ?? null,
      domain,
    },
    location,
    workMode,
    employmentType: raw.employmentTypeHint ?? inferEmploymentType(title, description),
    compensation: raw.compensation ?? emptyCompensation(null),
    duration,
    skills: extractSkills(title, description),
    eligibility: { ...EMPTY_ELIGIBILITY },
    description,
    descriptionHtml,
    applyUrl: raw.applyUrl,
    postedAt: raw.postedAt ?? null,
    deadlineAt: raw.deadlineAt ?? null,
    tags: dedupeTags(raw.tags ?? []),
    sources: [{
      provider: raw.provider,
      externalId: String(raw.externalId),
      url: raw.applyUrl,
      fetchedAt: isoNow(),
    } satisfies SourceRef],
    sourceConfidence: raw.confidence ?? 0.7,
  };
}

function dedupeTags(tags: readonly string[]): string[] {
  const set = new Set<string>();
  for (const tag of tags) {
    const clean = collapseWhitespace(tag).toLowerCase();
    if (clean && clean.length <= 40) set.add(clean);
  }
  return [...set].slice(0, 20);
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
