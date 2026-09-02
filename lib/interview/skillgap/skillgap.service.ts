/**
 * lib/interview/skillgap/skillgap.service.ts
 */
import { runStructured } from "../../ai/services/_run-structured";
import { ROADMAP_PROMPT, type RoadmapOutput } from "../prompts/roadmap";
import type { EvaluationScores, SkillScore } from "../models/interview.model";

export interface ScoredQuestion {
  topic: string;
  scores: EvaluationScores;
}

const WEAK_THRESHOLD = 6;
const STRONG_THRESHOLD = 8;

/**
 * Aggregates per-question evaluation scores into per-topic averages, using
 * the mean of technicalDepth/correctness/problemSolving/logic as the
 * "skill" score for that topic (the dimensions most tied to subject-matter
 * competence rather than delivery).
 */
export function computeSkillScores(questions: ScoredQuestion[]): SkillScore[] {
  const byTopic = new Map<string, number[]>();

  for (const q of questions) {
    const competence =
      (q.scores.technicalDepth + q.scores.correctness + q.scores.problemSolving + q.scores.logic) / 4;
    const list = byTopic.get(q.topic) ?? [];
    list.push(competence);
    byTopic.set(q.topic, list);
  }

  return Array.from(byTopic.entries()).map(([skill, values]) => ({
    skill,
    score: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
  }));
}

export function splitWeakAndStrong(scores: SkillScore[]): { weak: SkillScore[]; strong: SkillScore[] } {
  return {
    weak: scores.filter((s) => s.score < WEAK_THRESHOLD).sort((a, b) => a.score - b.score),
    strong: scores.filter((s) => s.score >= STRONG_THRESHOLD).sort((a, b) => b.score - a.score),
  };
}

export async function buildSkillGapRoadmap(
  userId: string,
  role: string,
  questions: ScoredQuestion[],
  opts: { forceRefresh?: boolean; requestId?: string } = {}
): Promise<{ weakSkills: SkillScore[]; strongSkills: SkillScore[] } & RoadmapOutput> {
  const scores = computeSkillScores(questions);
  const { weak, strong } = splitWeakAndStrong(scores);

  const { roadmap } = await runStructured(ROADMAP_PROMPT, {
    userId,
    input: { role, weakSkills: weak, strongSkills: strong },
    ...opts,
  });

  return { weakSkills: weak, strongSkills: strong, roadmap };
}
