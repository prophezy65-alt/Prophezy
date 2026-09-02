import type { Currency, StipendPeriod } from '../types';

/** Approximate FX to INR. Override at runtime via `FX_RATES_JSON` if you wire a rates feed. */
export const FX_TO_INR: Record<Currency, number> = {
  INR: 1,
  USD: 86,
  EUR: 93,
  GBP: 109,
  SGD: 64,
  AUD: 56,
  CAD: 62,
  AED: 23,
  JPY: 0.56,
  CHF: 97,
};

/** Multiplier that converts an amount for `period` into a per-month amount. */
export const PERIOD_TO_MONTHLY: Record<StipendPeriod, number> = {
  hour: 160,
  day: 22,
  week: 4.33,
  month: 1,
  year: 1 / 12,
  total: 1 / 3,
};

export const INTERNSHIP_TITLE_SIGNALS = [
  'intern', 'internship', 'trainee', 'apprentice', 'co-op', 'coop',
  'summer analyst', 'graduate program', 'fresher', 'campus',
] as const;

/**
 * 'apprentice' and 'trainee' are legitimate signals for tech/business
 * apprenticeships (software apprenticeship, finance trainee scheme) — but
 * with no domain qualifier they also match completely unrelated skilled-
 * trade roles (gas engineer, electrician, machinist), which have nothing to
 * do with a student tech/business/research career platform. These are
 * title-only exclusions (see looksLikeInternship — checked against title,
 * not description), same mechanism already used for seniority terms below.
 */
const TRADE_AND_VOCATIONAL_EXCLUSIONS = [
  'gas engineer', 'electrician', 'plumber', 'plumbing', 'hvac',
  'machinist', 'mechanic', 'welder', 'welding', 'carpenter', 'carpentry',
  'bricklayer', 'roofer', 'roofing', 'fitter', 'scaffolder', 'groundworker',
  'plasterer', 'painter and decorator', 'joiner', 'glazier', 'locksmith',
  'forklift', 'warehouse operative', 'construction labourer', 'labourer',
  'hairdresser', 'hairdressing', 'beautician', 'beauty therapist',
  'chef', 'catering', 'butcher', 'baker,', ' baker ',
  'hgv driver', 'delivery driver', 'lorry driver', 'van driver',
  'landscaper', 'landscaping', 'gardener', 'groundsman',
  'vehicle technician', 'motor vehicle', 'automotive technician',
] as const;

export const EXCLUDED_TITLE_SIGNALS = [
  'senior', 'staff', 'principal', 'lead ', 'head of', 'director',
  'vp ', 'vice president', 'manager,', ' manager', 'architect',
  ...TRADE_AND_VOCATIONAL_EXCLUSIONS,
] as const;

export const CACHE_TTL_SECONDS = {
  search: 120,
  internship: 600,
  recommendations: 900,
  providerHealth: 300,
  analytics: 300,
} as const;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Cosine-similarity threshold above which two postings are treated as duplicates. */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.86;
export const DUPLICATE_TITLE_THRESHOLD = 0.82;
/** Stemmed-token Jaccard above which two titles are treated as the same role. */
export const DUPLICATE_TOKEN_THRESHOLD = 0.85;

export const EMBEDDING_DIMENSIONS = 768;
