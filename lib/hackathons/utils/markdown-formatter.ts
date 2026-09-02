/**
 * markdown-formatter.ts
 * Converts hackathon guidance objects into clean Markdown for export.
 */

import {
  Hackathon,
  HackathonIdea,
  PreparationTimeline,
  Checklist,
  PitchOutline,
  ArchitecturePlan,
  HackathonMatchScore,
} from "../models/hackathon.model";
import { summarizePrizeStructure } from "./prize-analyzer";

export function hackathonToMarkdown(hackathon: Hackathon, matchScore?: HackathonMatchScore): string {
  const lines: string[] = [
    `# ${hackathon.title}`,
    "",
    `**Organizer:** ${hackathon.organizer.name}  `,
    `**Mode:** ${hackathon.mode}${hackathon.location ? ` (${hackathon.location})` : ""}  `,
    `**Submission deadline:** ${hackathon.timeline.submissionDeadline}  `,
    `**Prizes:** ${summarizePrizeStructure(hackathon.prizes)}`,
    "",
    hackathon.description,
  ];

  if (matchScore) {
    lines.push("", `**Match score:** ${matchScore.overallMatchPercent}% (skills ${matchScore.skillMatchPercent}%, theme ${matchScore.themeMatchPercent}%)`);
  }

  if (hackathon.themes.length) lines.push("", `**Themes:** ${hackathon.themes.join(", ")}`);
  if (hackathon.technologies.length) lines.push(`**Technologies:** ${hackathon.technologies.join(", ")}`);

  return lines.join("\n");
}

export function ideaToMarkdown(idea: HackathonIdea): string {
  return [
    `## ${idea.title}`,
    idea.pitch,
    "",
    `**Problem solved:** ${idea.problemSolved}`,
    `**Target users:** ${idea.targetUsers.join(", ")}`,
    `**Key features:** ${idea.keyFeatures.join(", ")}`,
    `**Suggested stack:** ${idea.techStackSuggestion.join(", ")}`,
    `**Novelty:** ${idea.noveltyScore}/100 · **Feasibility:** ${idea.feasibilityScore}/100`,
  ].join("\n");
}

export function timelineToMarkdown(timeline: PreparationTimeline): string {
  const lines: string[] = [`# Preparation Timeline`, "", `_Total estimated effort: ${timeline.totalEstimatedHours} hours_`, ""];
  for (const m of timeline.milestones) {
    lines.push(`## ${m.order + 1}. ${m.title}${m.dueAt ? ` (due ${m.dueAt})` : ""}`);
    lines.push(m.description);
    lines.push(`_Estimated: ${m.estimatedHours}h_`);
    lines.push("");
  }
  return lines.join("\n");
}

export function checklistToMarkdown(checklist: Checklist): string {
  const categories = ["submission", "presentation", "demo", "judging"] as const;
  const lines: string[] = ["# Checklist", ""];
  for (const category of categories) {
    const items = checklist.items.filter((i) => i.category === category);
    if (!items.length) continue;
    lines.push(`## ${category[0]!.toUpperCase()}${category.slice(1)}`);
    items.forEach((i) => lines.push(`- [${i.done ? "x" : " "}] ${i.label}`));
    lines.push("");
  }
  return lines.join("\n");
}

export function pitchOutlineToMarkdown(pitch: PitchOutline): string {
  return [
    "# Pitch Outline",
    "",
    `**Hook:** ${pitch.hookLine}`,
    "",
    `## Problem`,
    pitch.problemSlide,
    "",
    `## Solution`,
    pitch.solutionSlide,
    "",
    `## Demo Flow`,
    ...pitch.demoFlow.map((step, i) => `${i + 1}. ${step}`),
    "",
    `## Impact`,
    pitch.impactSlide,
    "",
    `**Closing:** ${pitch.closingLine}`,
  ].join("\n");
}

export function architecturePlanToMarkdown(plan: ArchitecturePlan): string {
  return [
    "# Architecture Plan",
    "",
    plan.overview,
    "",
    "## Frontend",
    ...plan.frontend.map((f) => `- ${f}`),
    "",
    "## Backend",
    ...plan.backend.map((b) => `- ${b}`),
    "",
    `## Database`,
    plan.database,
    "",
    "## APIs",
    ...plan.apis.map((a) => `- ${a}`),
    "",
    "## Deployment",
    ...plan.deployment.map((d) => `- ${d}`),
    "",
    "## Suggested Folder Structure",
    "```",
    ...plan.folderStructure,
    "```",
  ].join("\n");
}
