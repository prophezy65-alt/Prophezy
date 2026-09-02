/**
 * theme-analyzer.ts
 * Deterministic theme matching between a hackathon and a user's
 * preferences — no AI call required. Used for fast filtering/ranking;
 * `analysis.service.ts` layers AI-based ThemeAnalysis on top for deeper
 * qualitative insight.
 */

import { Hackathon, HackathonUserProfile } from "../models/hackathon.model";

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function calculateThemeMatchPercent(hackathon: Hackathon, profile: HackathonUserProfile): number {
  if (profile.preferredThemes.length === 0) return 50; // neutral when no preference set

  const hackathonThemes = new Set(hackathon.themes.map(normalize));
  const matched = profile.preferredThemes.filter((theme) =>
    [...hackathonThemes].some((t) => t.includes(normalize(theme)) || normalize(theme).includes(t))
  );

  return Math.round((matched.length / profile.preferredThemes.length) * 100);
}

export function extractThemeKeywords(hackathon: Hackathon): string[] {
  const keywords = new Set<string>();
  hackathon.themes.forEach((t) => keywords.add(normalize(t)));

  // Pull a few likely theme signals out of the title/description as a
  // deterministic supplement to the source's own theme tags.
  const commonThemeWords = [
    "ai", "machine learning", "web3", "blockchain", "climate", "sustainability",
    "healthcare", "fintech", "education", "gaming", "ar/vr", "iot", "cybersecurity",
    "social good", "accessibility", "developer tools", "open source",
  ];
  const combinedText = `${hackathon.title} ${hackathon.description}`.toLowerCase();
  commonThemeWords.forEach((word) => {
    if (combinedText.includes(word)) keywords.add(word);
  });

  return [...keywords];
}
