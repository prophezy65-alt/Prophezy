/**
 * technology-analyzer.ts
 * Deterministic technology matching and trend aggregation across a set of
 * hackathons — no AI call required.
 */

import { Hackathon, HackathonUserProfile } from "../models/hackathon.model";

function normalize(tech: string): string {
  return tech.trim().toLowerCase().replace(/\.js$/, "").replace(/[.\-_]/g, " ");
}

export function calculateTechnologyMatchPercent(hackathon: Hackathon, profile: HackathonUserProfile): number {
  if (hackathon.technologies.length === 0) return 50; // neutral when source didn't specify constraints

  const userSkills = new Set([...profile.skills, ...profile.preferredTechnologies].map(normalize));
  const matched = hackathon.technologies.filter((tech) => {
    const normalizedTech = normalize(tech);
    return [...userSkills].some((s) => s === normalizedTech || s.includes(normalizedTech) || normalizedTech.includes(s));
  });

  return Math.round((matched.length / hackathon.technologies.length) * 100);
}

/**
 * Aggregates the most frequently required technologies across a list of
 * hackathons — powers "Technology Trend Analysis" without an AI call.
 */
export function calculateTechnologyTrends(hackathons: Hackathon[], topN = 15): { technology: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const h of hackathons) {
    for (const tech of h.technologies) {
      const key = normalize(tech);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([technology, count]) => ({ technology, count }));
}
