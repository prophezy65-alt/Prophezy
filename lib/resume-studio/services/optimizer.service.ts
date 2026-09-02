/**
 * optimizer.service.ts
 * Takes an existing resume + target job description and produces an
 * optimized version: rewritten bullets with better keyword alignment,
 * a ranked list of missing keywords/skills, and a diffable set of changes.
 *
 * Built on top of generator.service.ts (per-bullet rewrite calls) and
 * resume-keywords.ts (deterministic gap analysis) rather than one giant
 * "rewrite the whole resume" prompt — this keeps output grounded in the
 * user's real experience instead of letting the model invent content.
 */

import {
  ResumeContent,
  ExperienceEntry,
  ProjectEntry,
  ServiceResult,
  success,
  failure,
} from "../models/resume.model";
import { matchKeywords } from "../utils/resume-keywords";
import { generateContent } from "./generator.service";

export interface OptimizedBulletChange {
  entryId: string;
  entryType: "experience" | "project";
  bulletIndex: number;
  original: string;
  optimized: string;
}

export interface OptimizeResumeResult {
  changes: OptimizedBulletChange[];
  missingKeywords: string[];
  matchPercentageBefore: number;
  suggestedSkillsToAdd: string[];
}

async function optimizeEntryBullets(
  entries: (ExperienceEntry | ProjectEntry)[],
  type: "experience" | "project",
  jobDescription: string,
  targetRole?: string
): Promise<OptimizedBulletChange[]> {
  const changes: OptimizedBulletChange[] = [];

  for (const entry of entries) {
    for (let i = 0; i < entry.bullets.length; i++) {
      const original = entry.bullets[i]!;
      const result = await generateContent({
        task: "optimize_keywords",
        input: original,
        context: { targetRole, jobDescription },
      });

      if (result.ok && result.data) {
        changes.push({
          entryId: entry.id,
          entryType: type,
          bulletIndex: i,
          original,
          optimized: result.data.output,
        });
      }
    }
  }

  return changes;
}

export async function optimizeResumeForJob(
  content: ResumeContent,
  jobDescription: string,
  targetRole?: string
): Promise<ServiceResult<OptimizeResumeResult>> {
  if (!jobDescription?.trim()) {
    return failure("INVALID_INPUT", "A job description is required to optimize a resume.");
  }

  try {
    const keywordResult = matchKeywords(content, jobDescription);

    const experienceChanges = await optimizeEntryBullets(
      content.experience,
      "experience",
      jobDescription,
      targetRole
    );
    const projectChanges = await optimizeEntryBullets(
      content.projects,
      "project",
      jobDescription,
      targetRole
    );

    const skillSuggestion = await generateContent({
      task: "suggest_missing_skills",
      input: JSON.stringify({
        currentSkills: content.skills.flatMap((s) => s.items),
        jobDescription,
      }),
      context: { targetRole },
    });

    const suggestedSkillsToAdd = skillSuggestion.ok && skillSuggestion.data
      ? skillSuggestion.data.output
          .split(/[,\n]/)
          .map((s) => s.replace(/^[-•\d.]\s*/, "").trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];

    return success<OptimizeResumeResult>({
      changes: [...experienceChanges, ...projectChanges],
      missingKeywords: keywordResult.missing,
      matchPercentageBefore: keywordResult.matchPercentage,
      suggestedSkillsToAdd,
    });
  } catch (err) {
    return failure("OPTIMIZATION_FAILED", (err as Error).message);
  }
}

/**
 * Applies a set of accepted optimizer changes back onto resume content,
 * returning a new ResumeContent object (immutable update).
 */
export function applyOptimizerChanges(
  content: ResumeContent,
  changes: OptimizedBulletChange[]
): ResumeContent {
  const updated: ResumeContent = {
    ...content,
    experience: content.experience.map((e) => ({ ...e, bullets: [...e.bullets] })),
    projects: content.projects.map((p) => ({ ...p, bullets: [...p.bullets] })),
  };

  for (const change of changes) {
    const list = change.entryType === "experience" ? updated.experience : updated.projects;
    const entry = list.find((e) => e.id === change.entryId);
    if (entry && entry.bullets[change.bulletIndex] !== undefined) {
      entry.bullets[change.bulletIndex] = change.optimized;
    }
  }

  return updated;
}
