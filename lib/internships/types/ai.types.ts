export interface UserProfileSnapshot {
  userId: string;
  degree: string | null;
  branch: string | null;
  graduationYear: number | null;
  cgpa: number | null;
  skills: string[];
  preferredRoles: string[];
  preferredLocations: string[];
  preferredWorkModes: string[];
  minStipendInr: number | null;
  resumeText: string | null;
  resumeEmbedding: number[] | null;
}

export interface SkillGapItem {
  skill: string;
  importance: 'critical' | 'important' | 'nice_to_have';
  reason: string;
}

export interface MatchExplanation {
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface MatchResult {
  internshipId: string;
  userId: string;
  resumeMatch: number;
  atsMatch: number;
  eligibilityScore: number;
  applicationReadiness: number;
  rankingScore: number;
  recommendationScore: number;
  eligible: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  skillGaps: SkillGapItem[];
  explanation: MatchExplanation;
  suggestedProjects: string[];
  suggestedCourses: string[];
  interviewPrep: string[];
  model: string;
  computedAt: string;
}

export interface AIRunOptions {
  feature: string;
  userId?: string | null;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

/**
 * Minimal contract the engine needs from Prophezy's existing AI Core Engine.
 * `lib/internships/ai/engine.adapter.ts` binds this to `lib/ai/engine.ts`.
 */
export interface AIRunner {
  runJson<T>(systemPrompt: string, userPrompt: string, options: AIRunOptions): Promise<T>;
  embed(input: string | string[]): Promise<number[][]>;
}
