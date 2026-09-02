/**
 * keyword-search.ts
 * Deterministic keyword search over the static catalog (roles, industries,
 * companies) and roadmap templates. Used as the fast/free fallback path
 * when vector search (pgvector) is unavailable, and to pre-filter
 * candidates before an optional semantic re-rank.
 */

import { SearchDomain, SearchResultItem } from "../models/career.model";
import { ROLE_CATALOG, INDUSTRY_CATALOG, COMPANY_CATALOG } from "../recommendations/catalog";
import { ROADMAP_TEMPLATES } from "../roadmaps/roadmap-templates";

function scoreTextMatch(query: string, text: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = text.toLowerCase();
  if (!normalizedQuery) return 0;
  if (normalizedText.includes(normalizedQuery)) return 1;

  const queryWords = normalizedQuery.split(/\s+/);
  const matchedWords = queryWords.filter((w) => normalizedText.includes(w));
  return matchedWords.length / queryWords.length;
}

function searchRoles(query: string): SearchResultItem[] {
  return ROLE_CATALOG.map((role) => ({
    id: role.id,
    domain: "career" as SearchDomain,
    title: role.title,
    snippet: role.description,
    score: Math.max(
      scoreTextMatch(query, role.title),
      scoreTextMatch(query, role.description),
      scoreTextMatch(query, role.coreSkills.join(" "))
    ),
  })).filter((r) => r.score > 0);
}

function searchIndustries(query: string): SearchResultItem[] {
  return INDUSTRY_CATALOG.map((industry) => ({
    id: industry.id,
    domain: "career" as SearchDomain,
    title: industry.name,
    snippet: industry.description,
    score: Math.max(scoreTextMatch(query, industry.name), scoreTextMatch(query, industry.description)),
  })).filter((r) => r.score > 0);
}

function searchCompanies(query: string): SearchResultItem[] {
  return COMPANY_CATALOG.map((company) => ({
    id: company.id,
    domain: "company" as SearchDomain,
    title: company.name,
    snippet: `${company.industry} · ${company.size} · Known for: ${company.knownForRoles.join(", ")}`,
    score: Math.max(scoreTextMatch(query, company.name), scoreTextMatch(query, company.hiringFocusAreas.join(" "))),
  })).filter((r) => r.score > 0);
}

function searchSkills(query: string): SearchResultItem[] {
  const allSkills = new Set<string>();
  ROLE_CATALOG.forEach((r) => [...r.coreSkills, ...r.niceToHaveSkills].forEach((s) => allSkills.add(s)));

  return [...allSkills]
    .map((skill) => ({
      id: `skill-${skill.replace(/\s+/g, "-")}`,
      domain: "skill" as SearchDomain,
      title: skill,
      snippet: `Relevant to: ${ROLE_CATALOG.filter((r) => [...r.coreSkills, ...r.niceToHaveSkills].includes(skill))
        .map((r) => r.title)
        .join(", ")}`,
      score: scoreTextMatch(query, skill),
    }))
    .filter((r) => r.score > 0);
}

function searchRoadmaps(query: string): SearchResultItem[] {
  return Object.keys(ROADMAP_TEMPLATES)
    .map((roleKey) => ({
      id: `roadmap-${roleKey.replace(/\s+/g, "-")}`,
      domain: "roadmap" as SearchDomain,
      title: `Roadmap: ${roleKey}`,
      snippet: `${ROADMAP_TEMPLATES[roleKey]!.length} milestones`,
      score: scoreTextMatch(query, roleKey),
    }))
    .filter((r) => r.score > 0);
}

export function keywordSearch(domain: SearchDomain, query: string, limit = 10): SearchResultItem[] {
  let results: SearchResultItem[] = [];

  switch (domain) {
    case "career":
      results = [...searchRoles(query), ...searchIndustries(query)];
      break;
    case "company":
      results = searchCompanies(query);
      break;
    case "skill":
      results = searchSkills(query);
      break;
    case "roadmap":
      results = searchRoadmaps(query);
      break;
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
