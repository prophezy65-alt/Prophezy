// lib/humanizer/utils/markdown-builder.ts
import type { Rewrite } from "../models/types";

export function buildRewriteMarkdown(rewrite: Rewrite, includeOriginal: boolean, includeAnalysis: boolean): string {
  const parts: string[] = [];

  parts.push(`# Rewrite (${rewrite.options.style}${rewrite.options.tone ? `, ${rewrite.options.tone} tone` : ""})\n`);

  if (includeOriginal) {
    parts.push("## Original\n");
    parts.push(`${rewrite.originalText}\n`);
  }

  parts.push("## Rewritten\n");
  parts.push(`${rewrite.rewrittenText}\n`);

  parts.push(`**Summary of changes:** ${rewrite.changesSummary}\n`);

  if (includeAnalysis) {
    parts.push("## Analysis\n");
    parts.push(`- Grammar score: ${rewrite.grammar.score}/100`);
    parts.push(`- Flesch Reading Ease: ${rewrite.readability.fleschReadingEase}`);
    parts.push(`- Flesch-Kincaid Grade: ${rewrite.readability.fleschKincaidGrade}`);
    parts.push(`- Clarity score: ${rewrite.readability.clarityScore}/100`);
    parts.push(`- Professionalism score: ${rewrite.readability.professionalismScore}/100`);
    parts.push(`- Vocabulary diversity: ${rewrite.readability.vocabularyDiversity}`);
    parts.push(`- Detected tone: ${rewrite.toneProfile.detectedTone} (formality ${rewrite.toneProfile.formalityScore}/100)\n`);
  }

  return parts.join("\n");
}
