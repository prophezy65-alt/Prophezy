/**
 * export-builder.ts
 * Assembles a full HackathonPrepReport (hackathon + idea + timeline +
 * checklist + pitch + architecture) and dispatches to the correct
 * text-based exporter. Binary formats (PDF/DOCX) live in `export/`.
 */

import {
  Hackathon,
  HackathonIdea,
  PreparationTimeline,
  Checklist,
  PitchOutline,
  ArchitecturePlan,
  HackathonMatchScore,
  ExportFormat,
} from "../models/hackathon.model";
import { toPrettyJson } from "./json-formatter";
import {
  hackathonToMarkdown,
  ideaToMarkdown,
  timelineToMarkdown,
  checklistToMarkdown,
  pitchOutlineToMarkdown,
  architecturePlanToMarkdown,
} from "./markdown-formatter";

export interface HackathonPrepReport {
  generatedAt: string;
  hackathon: Hackathon;
  matchScore?: HackathonMatchScore;
  idea?: HackathonIdea;
  architecture?: ArchitecturePlan;
  timeline?: PreparationTimeline;
  checklist?: Checklist;
  pitch?: PitchOutline;
}

export function buildPrepReportMarkdown(report: HackathonPrepReport): string {
  const sections = [
    `# Hackathon Prep Report`,
    `_Generated: ${report.generatedAt}_`,
    "",
    hackathonToMarkdown(report.hackathon, report.matchScore),
  ];

  if (report.idea) sections.push("", ideaToMarkdown(report.idea));
  if (report.architecture) sections.push("", architecturePlanToMarkdown(report.architecture));
  if (report.timeline) sections.push("", timelineToMarkdown(report.timeline));
  if (report.checklist) sections.push("", checklistToMarkdown(report.checklist));
  if (report.pitch) sections.push("", pitchOutlineToMarkdown(report.pitch));

  return sections.join("\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function markdownToHtmlFragment(markdown: string): string {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ") || /^\d+\.\s/.test(line)) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${escapeHtml(line.replace(/^-\s|^\d+\.\s/, ""))}</li>`);
    } else if (line.trim() === "") {
      if (inList) { html.push("</ul>"); inList = false; }
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      const bolded = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html.push(`<p>${bolded}</p>`);
    }
  }
  if (inList) html.push("</ul>");

  return html.join("\n");
}

export function buildPrepReportHtml(report: HackathonPrepReport): string {
  const bodyHtml = markdownToHtmlFragment(buildPrepReportMarkdown(report));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Hackathon Prep Report</title>
<style>
  body { font-family: Inter, Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.5; }
  h1 { border-bottom: 2px solid #7C3AED; padding-bottom: 8px; }
  h2 { color: #7C3AED; margin-top: 28px; }
  ul { margin-top: 4px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function buildPrepReportJson(report: HackathonPrepReport): string {
  return toPrettyJson(report);
}

export function exportPrepReport(
  report: HackathonPrepReport,
  format: ExportFormat
): { format: ExportFormat; content: string; requiresBinaryGenerator: boolean } {
  switch (format) {
    case "json":
      return { format, content: buildPrepReportJson(report), requiresBinaryGenerator: false };
    case "markdown":
      return { format, content: buildPrepReportMarkdown(report), requiresBinaryGenerator: false };
    case "html":
      return { format, content: buildPrepReportHtml(report), requiresBinaryGenerator: false };
    case "pdf":
    case "docx":
      return { format, content: "", requiresBinaryGenerator: true };
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
