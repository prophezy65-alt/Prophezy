/**
 * resume-score.ts
 * Deterministic, explainable scoring — independent of any AI call so it's
 * fast, free, and reproducible. The ATS service composes this with
 * AI-based checks for the full report.
 */

import { ResumeContent, ExperienceEntry, ProjectEntry } from "../models/resume.model";

export interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  reasons: string[];
}

const ACTION_VERBS = [
  "built", "led", "designed", "implemented", "launched", "improved",
  "reduced", "increased", "created", "architected", "optimized", "automated",
  "developed", "shipped", "drove", "delivered", "scaled", "migrated",
  "mentored", "spearheaded", "streamlined", "engineered", "deployed",
];

const WEAK_STARTERS = [
  "responsible for", "worked on", "helped with", "involved in", "tasked with",
];

const NUMBER_PATTERN = /\d/;

function bulletHasActionVerb(bullet: string): boolean {
  const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  return ACTION_VERBS.includes(firstWord ?? "");
}

function bulletHasWeakStarter(bullet: string): boolean {
  const lower = bullet.toLowerCase();
  return WEAK_STARTERS.some((w) => lower.startsWith(w));
}

function bulletHasNumber(bullet: string): boolean {
  return NUMBER_PATTERN.test(bullet);
}

function scoreBullets(
  entries: (ExperienceEntry | ProjectEntry)[],
  label: string
): ScoreBreakdown {
  const bullets = entries.flatMap((e) => e.bullets);
  if (bullets.length === 0) {
    return { category: label, score: 0, maxScore: 100, reasons: [`No ${label.toLowerCase()} bullets found.`] };
  }

  const withActionVerb = bullets.filter(bulletHasActionVerb).length;
  const withNumbers = bullets.filter(bulletHasNumber).length;
  const weak = bullets.filter(bulletHasWeakStarter).length;

  const actionVerbRatio = withActionVerb / bullets.length;
  const numberRatio = withNumbers / bullets.length;
  const weakRatio = weak / bullets.length;

  const score = Math.round(
    actionVerbRatio * 50 + numberRatio * 40 + (1 - weakRatio) * 10
  );

  const reasons: string[] = [];
  if (actionVerbRatio < 0.6) {
    reasons.push(`Only ${Math.round(actionVerbRatio * 100)}% of bullets start with a strong action verb.`);
  }
  if (numberRatio < 0.4) {
    reasons.push(`Only ${Math.round(numberRatio * 100)}% of bullets include a measurable number.`);
  }
  if (weak > 0) {
    reasons.push(`${weak} bullet(s) use weak phrasing like "responsible for" or "worked on".`);
  }
  if (reasons.length === 0) {
    reasons.push("Strong, quantified, action-driven bullets.");
  }

  return { category: label, score: Math.min(100, score), maxScore: 100, reasons };
}

function scoreLength(content: ResumeContent): ScoreBreakdown {
  const bulletCount =
    (content.experience?.reduce((a, e) => a + e.bullets.length, 0) ?? 0) +
    (content.projects?.reduce((a, p) => a + p.bullets.length, 0) ?? 0);

  let score = 100;
  const reasons: string[] = [];

  if (bulletCount < 6) {
    score = 40;
    reasons.push("Resume content is thin — add more bullets to experience/projects.");
  } else if (bulletCount > 40) {
    score = 60;
    reasons.push("Resume may be too long/dense for a single page. Trim to strongest bullets.");
  } else {
    reasons.push("Resume length looks appropriate.");
  }

  return { category: "Length", score, maxScore: 100, reasons };
}

function scoreSections(content: ResumeContent): ScoreBreakdown {
  const required: (keyof ResumeContent)[] = ["contact", "summary", "skills"];
  const missing = required.filter((key) => {
    const val = content[key];
    if (key === "contact") return !content.contact?.fullName;
    if (key === "summary") return !content.summary?.summary;
    if (key === "skills") return !content.skills?.length;
    return !val;
  });

  const score = Math.round(((required.length - missing.length) / required.length) * 100);
  return {
    category: "Sections",
    score,
    maxScore: 100,
    reasons: missing.length
      ? [`Missing or empty: ${missing.join(", ")}`]
      : ["All core sections present."],
  };
}

export interface ResumeScoreResult {
  overallScore: number;
  breakdown: ScoreBreakdown[];
}

/**
 * Deterministic 0-100 score with explainable breakdown.
 * This is the "fast path" score shown instantly in the UI before/without
 * calling the AI-based ATS analysis.
 */
export function calculateResumeScore(content: ResumeContent): ResumeScoreResult {
  const breakdown: ScoreBreakdown[] = [
    scoreBullets(content.experience ?? [], "Experience Writing"),
    scoreBullets(content.projects ?? [], "Project Writing"),
    scoreLength(content),
    scoreSections(content),
  ];

  const overallScore = Math.round(
    breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length
  );

  return { overallScore, breakdown };
}
