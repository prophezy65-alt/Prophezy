// lib/humanizer/export/text-formats.export.ts
import type { Rewrite } from "../models/types";
import { buildRewriteMarkdown } from "../utils/markdown-builder";

export function exportToMarkdown(rewrite: Rewrite, includeOriginal: boolean, includeAnalysis: boolean): string {
  return buildRewriteMarkdown(rewrite, includeOriginal, includeAnalysis);
}

export function exportToTxt(rewrite: Rewrite, includeOriginal: boolean): string {
  const parts: string[] = [];
  if (includeOriginal) {
    parts.push("ORIGINAL:\n" + rewrite.originalText, "\n---\n");
  }
  parts.push("REWRITTEN:\n" + rewrite.rewrittenText);
  return parts.join("\n");
}

export function exportToJson(rewrite: Rewrite, includeOriginal: boolean, includeAnalysis: boolean): string {
  const payload: Record<string, unknown> = {
    id: rewrite.id,
    options: rewrite.options,
    rewrittenText: rewrite.rewrittenText,
    changesSummary: rewrite.changesSummary,
    createdAt: rewrite.createdAt,
  };
  if (includeOriginal) payload.originalText = rewrite.originalText;
  if (includeAnalysis) {
    payload.grammar = rewrite.grammar;
    payload.readability = rewrite.readability;
    payload.toneProfile = rewrite.toneProfile;
  }
  return JSON.stringify(payload, null, 2);
}

export function exportToHtml(rewrite: Rewrite, includeOriginal: boolean, includeAnalysis: boolean): string {
  const analysisBlock = includeAnalysis
    ? `<h2>Analysis</h2>
<ul>
  <li>Grammar score: ${rewrite.grammar.score}/100</li>
  <li>Flesch Reading Ease: ${rewrite.readability.fleschReadingEase}</li>
  <li>Flesch-Kincaid Grade: ${rewrite.readability.fleschKincaidGrade}</li>
  <li>Clarity score: ${rewrite.readability.clarityScore}/100</li>
  <li>Professionalism score: ${rewrite.readability.professionalismScore}/100</li>
  <li>Detected tone: ${escapeHtml(rewrite.toneProfile.detectedTone)} (formality ${rewrite.toneProfile.formalityScore}/100)</li>
</ul>`
    : "";

  const originalBlock = includeOriginal
    ? `<h2>Original</h2><p>${escapeHtml(rewrite.originalText).replace(/\n/g, "<br/>")}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Rewrite — ${escapeHtml(rewrite.options.style)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
  .rewritten { background: #f8f9fb; border-left: 3px solid #4a6cf7; padding: 16px 20px; border-radius: 4px; }
</style>
</head>
<body>
<h1>Rewrite (${escapeHtml(rewrite.options.style)}${rewrite.options.tone ? `, ${escapeHtml(rewrite.options.tone)} tone` : ""})</h1>
${originalBlock}
<h2>Rewritten</h2>
<div class="rewritten"><p>${escapeHtml(rewrite.rewrittenText).replace(/\n/g, "<br/>")}</p></div>
<p><em>${escapeHtml(rewrite.changesSummary)}</em></p>
${analysisBlock}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
