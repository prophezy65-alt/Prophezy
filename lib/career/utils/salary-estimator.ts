/**
 * salary-estimator.ts
 * Deterministic baseline salary estimation using a static reference table
 * plus adjustment factors (experience level, country cost-of-living index,
 * optional company tier). This is the fallback/instant estimate;
 * salary.service.ts can enrich it with an AI Core call for more nuanced,
 * current-market commentary, but the numeric range itself stays
 * deterministic and explainable rather than hallucinated by an LLM.
 *
 * Every number is computed in USD first (the base reference table), then
 * converted into the target country's own currency via approximate FX
 * rates — the output is never labeled with a currency that doesn't match
 * the actual number.
 *
 * NOTE: The reference table, cost-of-living multipliers, and FX rates
 * below are illustrative starting data. In production this should be
 * backed by a real, regularly-updated dataset (e.g. a `salary_benchmarks`
 * table populated from a licensed data source, and a live FX rate feed).
 */

import { ExperienceLevel, SalaryEstimate } from "../models/career.model";

interface BaseSalaryUsd {
  role: string;
  domain: string;
  baseMedianUsd: number; // for "mid" level, US baseline
}

const BASE_SALARY_TABLE: BaseSalaryUsd[] = [
  { role: "Software Engineer", domain: "software", baseMedianUsd: 110000 },
  { role: "Frontend Engineer", domain: "software", baseMedianUsd: 105000 },
  { role: "Backend Engineer", domain: "software", baseMedianUsd: 112000 },
  { role: "Full Stack Engineer", domain: "software", baseMedianUsd: 108000 },
  { role: "Data Scientist", domain: "data", baseMedianUsd: 120000 },
  { role: "Data Analyst", domain: "data", baseMedianUsd: 85000 },
  { role: "Machine Learning Engineer", domain: "ai", baseMedianUsd: 130000 },
  { role: "AI Engineer", domain: "ai", baseMedianUsd: 132000 },
  { role: "DevOps Engineer", domain: "infrastructure", baseMedianUsd: 118000 },
  { role: "Product Manager", domain: "product", baseMedianUsd: 125000 },
  { role: "UX Designer", domain: "design", baseMedianUsd: 95000 },
  { role: "QA Engineer", domain: "software", baseMedianUsd: 90000 },
  { role: "Cybersecurity Analyst", domain: "security", baseMedianUsd: 105000 },
];

const EXPERIENCE_MULTIPLIER: Record<ExperienceLevel, number> = {
  student: 0.35,
  fresher: 0.55,
  junior: 0.75,
  mid: 1.0,
  senior: 1.45,
  lead: 1.9,
};

// Cost-of-living / market-rate index relative to the US baseline, plus the
// country's own currency and an approximate USD -> local-currency FX rate.
// Illustrative only — replace with a maintained dataset + live FX feed in
// production.
const COUNTRY_INDEX: Record<string, { multiplier: number; currency: string; usdToLocalFx: number }> = {
  "united states": { multiplier: 1.0, currency: "USD", usdToLocalFx: 1 },
  usa: { multiplier: 1.0, currency: "USD", usdToLocalFx: 1 },
  india: { multiplier: 0.22, currency: "INR", usdToLocalFx: 83 },
  "united kingdom": { multiplier: 0.75, currency: "GBP", usdToLocalFx: 0.79 },
  uk: { multiplier: 0.75, currency: "GBP", usdToLocalFx: 0.79 },
  canada: { multiplier: 0.78, currency: "CAD", usdToLocalFx: 1.36 },
  germany: { multiplier: 0.72, currency: "EUR", usdToLocalFx: 0.92 },
  france: { multiplier: 0.68, currency: "EUR", usdToLocalFx: 0.92 },
  netherlands: { multiplier: 0.76, currency: "EUR", usdToLocalFx: 0.92 },
  spain: { multiplier: 0.6, currency: "EUR", usdToLocalFx: 0.92 },
  italy: { multiplier: 0.6, currency: "EUR", usdToLocalFx: 0.92 },
  ireland: { multiplier: 0.78, currency: "EUR", usdToLocalFx: 0.92 },
  singapore: { multiplier: 0.85, currency: "SGD", usdToLocalFx: 1.34 },
  australia: { multiplier: 0.8, currency: "AUD", usdToLocalFx: 1.51 },
  "new zealand": { multiplier: 0.7, currency: "NZD", usdToLocalFx: 1.63 },
  uae: { multiplier: 0.7, currency: "AED", usdToLocalFx: 3.67 },
  "saudi arabia": { multiplier: 0.55, currency: "SAR", usdToLocalFx: 3.75 },
  japan: { multiplier: 0.6, currency: "JPY", usdToLocalFx: 149 },
  "south korea": { multiplier: 0.55, currency: "KRW", usdToLocalFx: 1330 },
  china: { multiplier: 0.5, currency: "CNY", usdToLocalFx: 7.2 },
  "hong kong": { multiplier: 0.75, currency: "HKD", usdToLocalFx: 7.8 },
  brazil: { multiplier: 0.3, currency: "BRL", usdToLocalFx: 5.4 },
  mexico: { multiplier: 0.28, currency: "MXN", usdToLocalFx: 17 },
  "south africa": { multiplier: 0.25, currency: "ZAR", usdToLocalFx: 18.5 },
  nigeria: { multiplier: 0.15, currency: "NGN", usdToLocalFx: 1500 },
  kenya: { multiplier: 0.15, currency: "KES", usdToLocalFx: 129 },
  philippines: { multiplier: 0.2, currency: "PHP", usdToLocalFx: 56 },
  indonesia: { multiplier: 0.22, currency: "IDR", usdToLocalFx: 15600 },
  vietnam: { multiplier: 0.18, currency: "VND", usdToLocalFx: 24500 },
  pakistan: { multiplier: 0.13, currency: "PKR", usdToLocalFx: 278 },
  bangladesh: { multiplier: 0.13, currency: "BDT", usdToLocalFx: 110 },
  poland: { multiplier: 0.45, currency: "PLN", usdToLocalFx: 4.0 },
  sweden: { multiplier: 0.75, currency: "SEK", usdToLocalFx: 10.4 },
  switzerland: { multiplier: 1.1, currency: "CHF", usdToLocalFx: 0.88 },
  israel: { multiplier: 0.85, currency: "ILS", usdToLocalFx: 3.7 },
};

// Rough company-tier premium/discount relative to the market-rate median
// for the role+country. Illustrative — a real implementation would source
// this from actual compensation-benchmark data per company.
const COMPANY_TIER: Record<string, number> = {
  google: 1.7,
  microsoft: 1.6,
  amazon: 1.55,
  meta: 1.7,
  apple: 1.65,
  netflix: 1.75,
  startup: 0.85,
  "early-stage startup": 0.75,
  tcs: 0.85,
  infosys: 0.85,
  wipro: 0.8,
  accenture: 0.95,
};

function findClosestRole(role: string): BaseSalaryUsd {
  const normalized = role.trim().toLowerCase();
  const exact = BASE_SALARY_TABLE.find((r) => r.role.toLowerCase() === normalized);
  if (exact) return exact;

  const partial = BASE_SALARY_TABLE.find(
    (r) => normalized.includes(r.role.toLowerCase()) || r.role.toLowerCase().includes(normalized)
  );
  if (partial) return partial;

  // Fallback: generic software engineer baseline with lower confidence.
  return BASE_SALARY_TABLE[0]!;
}

function findCompanyTier(company?: string): number | null {
  if (!company) return null;
  const normalized = company.trim().toLowerCase();
  if (COMPANY_TIER[normalized] !== undefined) return COMPANY_TIER[normalized]!;
  const partial = Object.entries(COMPANY_TIER).find(
    ([name]) => normalized.includes(name) || name.includes(normalized)
  );
  return partial ? partial[1] : null;
}

export function estimateSalary(
  role: string,
  country: string,
  experienceLevel: ExperienceLevel,
  company?: string
): SalaryEstimate {
  const baseRole = findClosestRole(role);
  const normalizedCountry = country.trim().toLowerCase();
  const countryData = COUNTRY_INDEX[normalizedCountry] ?? { multiplier: 0.5, currency: "USD", usdToLocalFx: 1 };
  const companyTier = findCompanyTier(company);

  // Internship compensation doesn't scale the same way a discounted
  // full-time salary does — most internships pay a flat stipend well
  // below even the "student" full-time multiplier would suggest.
  const isInternshipRole = /\bintern(ship)?\b/i.test(role);
  const internshipMultiplier = isInternshipRole ? 0.4 : 1;

  const medianUsd =
    baseRole.baseMedianUsd *
    EXPERIENCE_MULTIPLIER[experienceLevel] *
    countryData.multiplier *
    internshipMultiplier *
    (companyTier ?? 1);

  const medianLocal = Math.round(medianUsd * countryData.usdToLocalFx);
  const lowLocal = Math.round(medianLocal * 0.8);
  const highLocal = Math.round(medianLocal * 1.25);

  const isExactRoleMatch = baseRole.role.toLowerCase() === role.trim().toLowerCase();
  const isKnownCountry = Boolean(COUNTRY_INDEX[normalizedCountry]);
  const confidence: SalaryEstimate["confidence"] =
    isExactRoleMatch && isKnownCountry ? "high" : isExactRoleMatch || isKnownCountry ? "medium" : "low";

  const companyNote = company
    ? companyTier
      ? ` at ${company} (tier-adjusted ${companyTier}x market rate)`
      : ` at ${company} (no specific data for this company — using general market rate)`
    : "";
  const internshipNote = isInternshipRole ? " This is an internship-stipend estimate, not a full-time salary." : "";

  return {
    role,
    country,
    company,
    experienceLevel,
    currency: countryData.currency,
    low: lowLocal,
    median: medianLocal,
    high: highLocal,
    confidence,
    basis: `Estimated from baseline for "${baseRole.role}"${companyNote}, adjusted for ${experienceLevel} level and ${country} market index.${internshipNote} Illustrative — verify against current market data.`,
  };
}
