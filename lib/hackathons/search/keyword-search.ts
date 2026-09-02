/**
 * keyword-search.ts
 * Deterministic keyword search over an already-fetched set of hackathons
 * (from provider.service.ts's cache) plus derived technology/theme/
 * organizer indexes. Fallback path when vector search is unavailable.
 */

import { Hackathon, SearchDomain, SearchResultItem } from "../models/hackathon.model";

function scoreTextMatch(query: string, text: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = text.toLowerCase();
  if (!normalizedQuery) return 0;
  if (normalizedText.includes(normalizedQuery)) return 1;
  const words = normalizedQuery.split(/\s+/);
  const matched = words.filter((w) => normalizedText.includes(w));
  return matched.length / words.length;
}

function searchHackathons(hackathons: Hackathon[], query: string): SearchResultItem[] {
  return hackathons
    .map((h) => ({
      id: h.id,
      domain: "hackathon" as SearchDomain,
      title: h.title,
      snippet: h.description.slice(0, 160),
      score: Math.max(
        scoreTextMatch(query, h.title),
        scoreTextMatch(query, h.description),
        scoreTextMatch(query, h.themes.join(" ")),
        scoreTextMatch(query, h.technologies.join(" "))
      ),
    }))
    .filter((r) => r.score > 0);
}

function searchTechnologies(hackathons: Hackathon[], query: string): SearchResultItem[] {
  const techCounts = new Map<string, number>();
  hackathons.forEach((h) => h.technologies.forEach((t) => techCounts.set(t, (techCounts.get(t) ?? 0) + 1)));

  return [...techCounts.entries()]
    .map(([tech, count]) => ({
      id: `tech-${tech.replace(/\s+/g, "-")}`,
      domain: "technology" as SearchDomain,
      title: tech,
      snippet: `Used in ${count} hackathon${count === 1 ? "" : "s"}`,
      score: scoreTextMatch(query, tech),
    }))
    .filter((r) => r.score > 0);
}

function searchThemes(hackathons: Hackathon[], query: string): SearchResultItem[] {
  const themeCounts = new Map<string, number>();
  hackathons.forEach((h) => h.themes.forEach((t) => themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1)));

  return [...themeCounts.entries()]
    .map(([theme, count]) => ({
      id: `theme-${theme.replace(/\s+/g, "-")}`,
      domain: "theme" as SearchDomain,
      title: theme,
      snippet: `${count} hackathon${count === 1 ? "" : "s"} with this theme`,
      score: scoreTextMatch(query, theme),
    }))
    .filter((r) => r.score > 0);
}

function searchOrganizers(hackathons: Hackathon[], query: string): SearchResultItem[] {
  const organizers = new Map<string, number>();
  hackathons.forEach((h) => organizers.set(h.organizer.name, (organizers.get(h.organizer.name) ?? 0) + 1));

  return [...organizers.entries()]
    .map(([name, count]) => ({
      id: `organizer-${name.replace(/\s+/g, "-")}`,
      domain: "organizer" as SearchDomain,
      title: name,
      snippet: `${count} hackathon${count === 1 ? "" : "s"} organized`,
      score: scoreTextMatch(query, name),
    }))
    .filter((r) => r.score > 0);
}

export function keywordSearch(
  hackathons: Hackathon[],
  domain: SearchDomain,
  query: string,
  limit = 10
): SearchResultItem[] {
  let results: SearchResultItem[] = [];

  switch (domain) {
    case "hackathon":
      results = searchHackathons(hackathons, query);
      break;
    case "technology":
      results = searchTechnologies(hackathons, query);
      break;
    case "theme":
      results = searchThemes(hackathons, query);
      break;
    case "organizer":
    case "company":
      results = searchOrganizers(hackathons, query);
      break;
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
