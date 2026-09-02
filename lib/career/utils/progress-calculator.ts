/**
 * progress-calculator.ts
 * Deterministic calculators for learning progress, readiness, and the
 * composite career score shown on the student's dashboard.
 */

import { PerformanceSignals, AcademicProfile } from "../models/career.model";

/**
 * Blends quiz, interview, flashcards, and assignment signals into a single
 * 0-100 "learning progress" number. Missing signals are simply excluded
 * from the average rather than penalized, so partial data doesn't
 * artificially tank the score.
 */
export function calculateLearningProgress(performance: PerformanceSignals, syllabusProgressPercent?: number): number {
  const signals: number[] = [];

  if (performance.quizAverageScore !== undefined) signals.push(performance.quizAverageScore);
  if (performance.interviewAverageScore !== undefined) signals.push(performance.interviewAverageScore);
  if (performance.flashcardsRetentionRate !== undefined) signals.push(performance.flashcardsRetentionRate);
  if (performance.assignmentsCompletionRate !== undefined) signals.push(performance.assignmentsCompletionRate);
  if (syllabusProgressPercent !== undefined) signals.push(syllabusProgressPercent);

  if (signals.length === 0) return 0;
  return Math.round(signals.reduce((a, b) => a + b, 0) / signals.length);
}

/**
 * Readiness score: how prepared the student is right now for their target
 * role, blending skill-gap readiness (passed in) with interview/quiz
 * performance signals.
 */
export function calculateReadinessScore(
  skillGapReadinessPercent: number,
  performance: PerformanceSignals
): number {
  const interviewScore = performance.interviewAverageScore ?? skillGapReadinessPercent;
  const quizScore = performance.quizAverageScore ?? skillGapReadinessPercent;

  // Skill gap readiness weighted highest — it's the most direct signal for
  // "are you ready for this specific role".
  return Math.round(skillGapReadinessPercent * 0.5 + interviewScore * 0.3 + quizScore * 0.2);
}

/**
 * Composite 0-100 career score combining skill score, readiness, resume
 * strength, and academic standing (CGPA normalized to 0-100 on a 10-point
 * scale, if present).
 */
export function calculateCareerScore(params: {
  skillScore: number;
  readinessScore: number;
  resumeStrength: number;
  academic: AcademicProfile;
}): number {
  const { skillScore, readinessScore, resumeStrength, academic } = params;

  const cgpaScore = academic.cgpa !== undefined ? Math.min(100, (academic.cgpa / 10) * 100) : null;

  const components = [skillScore, readinessScore, resumeStrength, ...(cgpaScore !== null ? [cgpaScore] : [])];
  const weights = cgpaScore !== null ? [0.35, 0.35, 0.2, 0.1] : [0.4, 0.4, 0.2];

  const weightedSum = components.reduce((sum, val, i) => sum + val * weights[i]!, 0);
  return Math.round(weightedSum);
}
