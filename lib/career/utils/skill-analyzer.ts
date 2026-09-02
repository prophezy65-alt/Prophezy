/**
 * skill-analyzer.ts
 * Deterministic skill comparison/scoring — no AI call required. Used both
 * standalone (fast instant feedback) and as a pre-processing signal fed
 * into AI Core prompts so the model has a grounded starting point rather
 * than reasoning from scratch every time.
 */

import { SkillEntry, Role } from "../models/career.model";

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/[.\-_]/g, " ").replace(/\s+/g, " ");
}

export interface DeterministicSkillMatch {
  matchedSkills: string[];
  missingSkills: string[];
  matchPercent: number;
}

/**
 * Compares a student's known skills against a role's required skills using
 * normalized exact + substring matching (e.g. "react" matches "react.js").
 */
export function matchSkillsToRole(studentSkills: SkillEntry[], role: Role): DeterministicSkillMatch {
  const normalizedStudentSkills = new Set(studentSkills.map((s) => normalizeSkillName(s.name)));
  const requiredSkills = [...role.coreSkills, ...role.niceToHaveSkills];

  const matched: string[] = [];
  const missing: string[] = [];

  for (const required of requiredSkills) {
    const normalizedRequired = normalizeSkillName(required);
    const isMatch = [...normalizedStudentSkills].some(
      (known) => known === normalizedRequired || known.includes(normalizedRequired) || normalizedRequired.includes(known)
    );
    if (isMatch) matched.push(required);
    else missing.push(required);
  }

  const matchPercent = requiredSkills.length
    ? Math.round((matched.length / requiredSkills.length) * 100)
    : 0;

  return { matchedSkills: matched, missingSkills: missing, matchPercent };
}

/**
 * Computes a 0-100 "skill score" from a student's skill list, weighting
 * proficiency levels and count. Independent of any specific target role —
 * this is the general breadth/depth signal used in CareerAnalytics.
 */
export function calculateSkillScore(skills: SkillEntry[]): number {
  if (skills.length === 0) return 0;

  const proficiencyWeight: Record<NonNullable<SkillEntry["proficiency"]>, number> = {
    beginner: 0.4,
    intermediate: 0.7,
    advanced: 0.9,
    expert: 1.0,
  };

  const totalWeight = skills.reduce((sum, s) => sum + (proficiencyWeight[s.proficiency ?? "beginner"] ?? 0.4), 0);
  const averageWeight = totalWeight / skills.length;

  // Breadth bonus: more distinct, reasonably-proficient skills raises the score,
  // but with diminishing returns past ~20 skills.
  const breadthFactor = Math.min(1, skills.length / 20);

  const score = averageWeight * 70 + breadthFactor * 30;
  return Math.round(Math.min(100, score));
}

/**
 * Deduplicates and merges skill entries from multiple sources (resume,
 * quiz, flashcards, self-reported), preferring the highest proficiency
 * seen for a given skill name.
 */
export function mergeSkillSources(...sources: SkillEntry[][]): SkillEntry[] {
  const proficiencyRank: Record<NonNullable<SkillEntry["proficiency"]>, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
  };

  const merged = new Map<string, SkillEntry>();

  for (const source of sources) {
    for (const entry of source) {
      const key = normalizeSkillName(entry.name);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, entry);
        continue;
      }
      const existingRank = proficiencyRank[existing.proficiency ?? "beginner"];
      const newRank = proficiencyRank[entry.proficiency ?? "beginner"];
      if (newRank > existingRank) {
        merged.set(key, entry);
      }
    }
  }

  return [...merged.values()];
}
