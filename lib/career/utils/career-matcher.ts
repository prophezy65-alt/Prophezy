/**
 * career-matcher.ts
 * Deterministic matching between a student profile and roles/industries/
 * companies. Produces the *Match Percent* analytics without requiring an
 * AI call, so dashboards stay fast and cheap; AI-based recommendations
 * layer on top of these scores rather than replacing them.
 */

import { StudentCareerProfile, Role, Industry, Company } from "../models/career.model";
import { matchSkillsToRole } from "./skill-analyzer";

export function calculateRoleMatchPercent(profile: StudentCareerProfile, role: Role): number {
  const skillMatch = matchSkillsToRole(profile.skills, role);

  // Blend skill match with preference alignment: a small boost if the
  // student explicitly listed this role/domain as a target.
  const preferenceBoost = profile.preferences.targetRoles?.some(
    (r) => r.toLowerCase().includes(role.title.toLowerCase()) || role.title.toLowerCase().includes(r.toLowerCase())
  )
    ? 10
    : 0;

  return Math.min(100, skillMatch.matchPercent + preferenceBoost);
}

export function calculateIndustryMatchPercent(profile: StudentCareerProfile, industry: Industry, roles: Role[]): number {
  const industryRoles = roles.filter((r) => industry.relatedRoles.includes(r.id));
  if (industryRoles.length === 0) return 0;

  const scores = industryRoles.map((role) => calculateRoleMatchPercent(profile, role));
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;

  const preferenceBoost = profile.preferences.preferredIndustries?.some(
    (i) => i.toLowerCase() === industry.name.toLowerCase()
  )
    ? 10
    : 0;

  return Math.round(Math.min(100, average + preferenceBoost));
}

export function calculateCompanyMatchPercent(profile: StudentCareerProfile, company: Company, roles: Role[]): number {
  const relevantRoles = roles.filter((r) =>
    company.knownForRoles.some((title) => title.toLowerCase() === r.title.toLowerCase())
  );

  const roleScores = relevantRoles.length
    ? relevantRoles.map((role) => calculateRoleMatchPercent(profile, role))
    : [0];

  const average = roleScores.reduce((a, b) => a + b, 0) / roleScores.length;

  const preferenceBoost = profile.preferences.preferredCompanies?.some(
    (c) => c.toLowerCase() === company.name.toLowerCase()
  )
    ? 10
    : 0;

  return Math.round(Math.min(100, average + preferenceBoost));
}

/**
 * Ranks a list of roles by match percent for this student, descending.
 */
export function rankRolesByMatch(profile: StudentCareerProfile, roles: Role[]): { role: Role; matchPercent: number }[] {
  return roles
    .map((role) => ({ role, matchPercent: calculateRoleMatchPercent(profile, role) }))
    .sort((a, b) => b.matchPercent - a.matchPercent);
}
