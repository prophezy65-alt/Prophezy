/**
 * markdown-formatter.ts
 * Converts career guidance output objects into clean Markdown for export.
 */

import {
  LearningRoadmap,
  Recommendation,
  SkillGapAnalysis,
  CareerAnalytics,
  SalaryEstimate,
  HigherStudiesGuidance,
} from "../models/career.model";

export function roadmapToMarkdown(roadmap: LearningRoadmap): string {
  const lines: string[] = [
    `# Learning Roadmap: ${roadmap.targetRole}`,
    "",
    `_Total estimated time: ${roadmap.totalEstimatedWeeks} weeks_`,
    "",
  ];

  for (const m of roadmap.milestones) {
    lines.push(`## ${m.order + 1}. ${m.title} (${m.estimatedWeeks} weeks)`);
    lines.push(m.description);
    if (m.skillsCovered.length) lines.push(`**Skills covered:** ${m.skillsCovered.join(", ")}`);
    if (m.recommendedResources.length) {
      lines.push("**Resources:**");
      m.recommendedResources.forEach((r) => lines.push(`- ${r}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function recommendationsToMarkdown(recommendations: Recommendation[]): string {
  const lines: string[] = ["# Career Recommendations", ""];

  for (const rec of recommendations) {
    lines.push(`## ${rec.title} (${rec.confidenceScore}% confidence)`);
    lines.push(rec.rationale);
    if (rec.actionItems.length) {
      lines.push("**Action items:**");
      rec.actionItems.forEach((a) => lines.push(`- ${a}`));
    }
    if (rec.relatedLink) lines.push(`[Learn more](${rec.relatedLink})`);
    lines.push("");
  }

  return lines.join("\n");
}

export function skillGapToMarkdown(analysis: SkillGapAnalysis): string {
  const lines: string[] = [
    `# Skill Gap Analysis: ${analysis.targetRole}`,
    "",
    `**Overall readiness:** ${analysis.overallReadinessPercent}%`,
    "",
    `**Matched skills:** ${analysis.matchedSkills.join(", ") || "None yet"}`,
    "",
    "## Gaps to close",
    "",
  ];

  for (const gap of analysis.gaps) {
    lines.push(`- **${gap.skill}** (${gap.priority} priority) — ${gap.currentProficiency} → ${gap.requiredProficiency}. ${gap.reason}`);
  }

  return lines.join("\n");
}

export function analyticsToMarkdown(analytics: CareerAnalytics): string {
  return [
    "# Career Analytics",
    "",
    `- **Skill Score:** ${analytics.skillScore}/100`,
    `- **Readiness Score:** ${analytics.readinessScore}/100`,
    `- **Career Score:** ${analytics.careerScore}/100`,
    `- **Resume Strength:** ${analytics.resumeStrength}/100`,
    `- **Learning Progress:** ${analytics.learningProgressPercent}%`,
    "",
    "## Role Match",
    ...Object.entries(analytics.roleMatchPercent).map(([role, pct]) => `- ${role}: ${pct}%`),
    "",
    "## Industry Match",
    ...Object.entries(analytics.industryMatchPercent).map(([industry, pct]) => `- ${industry}: ${pct}%`),
  ].join("\n");
}

export function salaryEstimateToMarkdown(estimate: SalaryEstimate): string {
  return [
    `# Salary Estimate: ${estimate.role} (${estimate.experienceLevel}) — ${estimate.country}`,
    "",
    `**Range:** ${estimate.currency} ${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()}`,
    `**Median:** ${estimate.currency} ${estimate.median.toLocaleString()}`,
    `**Confidence:** ${estimate.confidence}`,
    "",
    estimate.basis,
  ].join("\n");
}

export function higherStudiesToMarkdown(guidance: HigherStudiesGuidance): string {
  return [
    `# ${guidance.program} Guidance`,
    "",
    `**Suitability score:** ${guidance.suitabilityScore}/100`,
    `**Typical timeline:** ${guidance.typicalTimelineMonths} months`,
    "",
    guidance.rationale,
    "",
    "## Recommended prerequisites",
    ...guidance.recommendedPrerequisites.map((p) => `- ${p}`),
    "",
    "## Recommended countries",
    ...guidance.recommendedCountries.map((c) => `- ${c}`),
  ].join("\n");
}
