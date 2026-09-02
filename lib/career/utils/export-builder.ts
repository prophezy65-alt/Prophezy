/**
 * export-builder.ts
 * Assembles a full CareerReport (analytics + roadmap + recommendations +
 * skill gap + salary) and dispatches to the correct text-based exporter.
 * Binary formats (PDF/DOCX) are handled separately in `export/` since they
 * need Node buffers rather than strings.
 */

import {
  CareerAnalytics,
  LearningRoadmap,
  Recommendation,
  SkillGapAnalysis,
  SalaryEstimate,
  ExportFormat,
} from "../models/career.model";
import { toPrettyJson } from "./json-formatter";
import {
  analyticsToMarkdown,
  roadmapToMarkdown,
  recommendationsToMarkdown,
  skillGapToMarkdown,
  salaryEstimateToMarkdown,
} from "./markdown-formatter";

export interface CareerReport {
  generatedAt: string;
  analytics: CareerAnalytics;
  roadmap?: LearningRoadmap;
  recommendations: Recommendation[];
  skillGap?: SkillGapAnalysis;
  salaryEstimate?: SalaryEstimate;
}

export function buildCareerReportMarkdown(report: CareerReport): string {
  const sections = [
    `# Career Guidance Report`,
    `_Generated: ${report.generatedAt}_`,
    "",
    analyticsToMarkdown(report.analytics),
  ];

  if (report.skillGap) sections.push("", skillGapToMarkdown(report.skillGap));
  if (report.roadmap) sections.push("", roadmapToMarkdown(report.roadmap));
  if (report.recommendations.length) sections.push("", recommendationsToMarkdown(report.recommendations));
  if (report.salaryEstimate) sections.push("", salaryEstimateToMarkdown(report.salaryEstimate));

  return sections.join("\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Very small Markdown -> HTML conversion tailored to the specific
 * structure our formatters produce (headings, bold, lists, links) — not a
 * general-purpose Markdown parser.
 */
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
    } else if (line.startsWith("- ")) {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`<li>${escapeHtml(line.slice(2))}</li>`);
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

export function buildCareerReportHtml(report: CareerReport): string {
  const markdown = buildCareerReportMarkdown(report);
  const bodyHtml = markdownToHtmlFragment(markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Career Guidance Report</title>
<style>
  body { font-family: Inter, Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.5; }
  h1 { border-bottom: 2px solid #2563EB; padding-bottom: 8px; }
  h2 { color: #2563EB; margin-top: 28px; }
  ul { margin-top: 4px; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function buildCareerReportJson(report: CareerReport): string {
  return toPrettyJson(report);
}

/**
 * Dispatches to the correct text-based exporter. For "pdf"/"docx", callers
 * must use the binary generators in `export/career-pdf.export.ts` and
 * `export/career-docx.export.ts` instead.
 */
export function exportCareerReport(
  report: CareerReport,
  format: ExportFormat
): { format: ExportFormat; content: string; requiresBinaryGenerator: boolean } {
  switch (format) {
    case "json":
      return { format, content: buildCareerReportJson(report), requiresBinaryGenerator: false };
    case "markdown":
      return { format, content: buildCareerReportMarkdown(report), requiresBinaryGenerator: false };
    case "html":
      return { format, content: buildCareerReportHtml(report), requiresBinaryGenerator: false };
    case "pdf":
    case "docx":
      return { format, content: "", requiresBinaryGenerator: true };
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
