/**
 * resume-export.ts
 * Format-specific exporters. JSON/Markdown/HTML are generated directly here
 * (pure string transforms). PDF and DOCX require binary generation and are
 * handled by generator.service.ts (pdf-lib / docx libraries), which this
 * module's `exportResume` delegates to.
 */

import { Resume, ExportFormat } from "../models/resume.model";
import { formatDateRange } from "./resume-formatter";

export function exportToJson(resume: Resume): string {
  return JSON.stringify(resume, null, 2);
}

export function exportToMarkdown(resume: Resume): string {
  const { content } = resume;
  const lines: string[] = [];

  lines.push(`# ${content.contact.fullName}`);

  const contactLine = [
    content.contact.email,
    content.contact.phone,
    content.contact.location,
  ]
    .filter(Boolean)
    .join(" | ");
  if (contactLine) lines.push(contactLine);

  if (content.contact.links.length) {
    lines.push(content.contact.links.map((l) => `[${l.label}](${l.url})`).join(" | "));
  }

  if (content.summary.summary) {
    lines.push("", "## Summary", content.summary.summary);
  }

  if (content.experience.length) {
    lines.push("", "## Experience");
    for (const exp of content.experience) {
      lines.push(`### ${exp.role} — ${exp.company}`);
      lines.push(`_${formatDateRange(exp.dateRange)}_`);
      exp.bullets.forEach((b) => lines.push(`- ${b}`));
      lines.push("");
    }
  }

  if (content.projects.length) {
    lines.push("## Projects");
    for (const proj of content.projects) {
      lines.push(`### ${proj.name}`);
      if (proj.description) lines.push(proj.description);
      proj.bullets.forEach((b) => lines.push(`- ${b}`));
      lines.push("");
    }
  }

  if (content.education.length) {
    lines.push("## Education");
    for (const edu of content.education) {
      lines.push(`### ${edu.degree} — ${edu.institution}`);
      lines.push(`_${formatDateRange(edu.dateRange)}_`);
      lines.push("");
    }
  }

  if (content.skills.length) {
    lines.push("## Skills");
    for (const group of content.skills) {
      lines.push(`**${group.category}:** ${group.items.join(", ")}`);
    }
    lines.push("");
  }

  if (content.certificates.length) {
    lines.push("## Certificates");
    content.certificates.forEach((c) => lines.push(`- ${c.name}${c.issuer ? ` — ${c.issuer}` : ""}`));
    lines.push("");
  }

  if (content.achievements.length) {
    lines.push("## Achievements");
    content.achievements.forEach((a) => lines.push(`- ${a.title}`));
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportToHtml(resume: Resume): string {
  const { content } = resume;

  const experienceHtml = content.experience
    .map(
      (exp) => `
        <section class="entry">
          <h3>${escapeHtml(exp.role)} — ${escapeHtml(exp.company)}</h3>
          <p class="date">${escapeHtml(formatDateRange(exp.dateRange))}</p>
          <ul>${exp.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
        </section>`
    )
    .join("");

  const projectsHtml = content.projects
    .map(
      (p) => `
        <section class="entry">
          <h3>${escapeHtml(p.name)}</h3>
          <ul>${p.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
        </section>`
    )
    .join("");

  const skillsHtml = content.skills
    .map((s) => `<p><strong>${escapeHtml(s.category)}:</strong> ${escapeHtml(s.items.join(", "))}</p>`)
    .join("");

  const contactLineHtml = [content.contact.email, content.contact.phone, content.contact.location]
    .filter((v): v is string => Boolean(v))
    .map(escapeHtml)
    .join(" | ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(content.contact.fullName)} — Resume</title>
<style>
  body { font-family: Inter, Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; }
  h1 { margin-bottom: 4px; }
  h3 { margin-bottom: 2px; }
  .date { color: #555; font-size: 0.9em; margin-top: 0; }
  .entry { margin-bottom: 18px; }
  ul { margin-top: 4px; }
</style>
</head>
<body>
  <h1>${escapeHtml(content.contact.fullName)}</h1>
  <p>${contactLineHtml}</p>
  ${content.summary.summary ? `<h2>Summary</h2><p>${escapeHtml(content.summary.summary)}</p>` : ""}
  ${content.experience.length ? `<h2>Experience</h2>${experienceHtml}` : ""}
  ${content.projects.length ? `<h2>Projects</h2>${projectsHtml}` : ""}
  ${content.skills.length ? `<h2>Skills</h2>${skillsHtml}` : ""}
</body>
</html>`;
}

/**
 * High-level export dispatcher. For "pdf" and "docx", this returns a marker
 * indicating the caller must use generator.service.ts's binary generators
 * (kept separate because those require Node buffers / pdf-lib, not strings).
 */
export function exportResume(
  resume: Resume,
  format: ExportFormat
): { format: ExportFormat; content: string; requiresBinaryGenerator: boolean } {
  switch (format) {
    case "json":
      return { format, content: exportToJson(resume), requiresBinaryGenerator: false };
    case "markdown":
      return { format, content: exportToMarkdown(resume), requiresBinaryGenerator: false };
    case "html":
      return { format, content: exportToHtml(resume), requiresBinaryGenerator: false };
    case "pdf":
    case "docx":
      return { format, content: "", requiresBinaryGenerator: true };
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
