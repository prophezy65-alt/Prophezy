/**
 * resume-analyzer.ts
 * Deterministic pre-pass comparing resume/profile skills against stated
 * career goals — a fast, free signal computed before (or independent of)
 * the AI Core resume-career-analysis call in resume-analysis.service.ts.
 */

import { StudentCareerProfile } from "../models/career.model";

export interface DeterministicResumeSignal {
  hasResume: boolean;
  hasGithub: boolean;
  hasLinkedin: boolean;
  skillCount: number;
  goalAlignmentHintPercent: number;
}

/**
 * Rough goal-alignment heuristic: what fraction of the student's stated
 * target roles/goals contain terms that also appear among their skills.
 * This is intentionally crude — it's a cheap pre-signal, not a substitute
 * for the AI Core's qualitative analysis.
 */
export function computeDeterministicResumeSignal(profile: StudentCareerProfile): DeterministicResumeSignal {
  const skillTerms = new Set(profile.skills.map((s) => s.name.toLowerCase()));
  const goals = [
    ...(profile.preferences.careerGoals ?? []),
    ...(profile.preferences.targetRoles ?? []),
  ];

  let alignedGoals = 0;
  for (const goal of goals) {
    const goalWords = goal.toLowerCase().split(/\s+/);
    const hasOverlap = goalWords.some((word) =>
      [...skillTerms].some((skill) => skill.includes(word) || word.includes(skill))
    );
    if (hasOverlap) alignedGoals++;
  }

  const goalAlignmentHintPercent = goals.length ? Math.round((alignedGoals / goals.length) * 100) : 0;

  return {
    hasResume: Boolean(profile.resumeSummary?.trim()),
    hasGithub: Boolean(profile.githubUrl?.trim()),
    hasLinkedin: Boolean(profile.linkedinUrl?.trim()),
    skillCount: profile.skills.length,
    goalAlignmentHintPercent,
  };
}
