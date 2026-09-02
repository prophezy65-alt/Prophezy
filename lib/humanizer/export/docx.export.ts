// lib/humanizer/export/docx.export.ts
// Peer dependency: npm install docx (shared with lib/assignment/export/docx.export.ts)

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { Rewrite } from "../models/types";

export async function exportToDocx(rewrite: Rewrite, includeOriginal: boolean, includeAnalysis: boolean): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: `Rewrite (${rewrite.options.style}${rewrite.options.tone ? `, ${rewrite.options.tone} tone` : ""})`,
      heading: HeadingLevel.TITLE,
    }),
  ];

  if (includeOriginal) {
    children.push(
      new Paragraph({ text: "Original", heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({ text: rewrite.originalText })
    );
  }

  children.push(
    new Paragraph({ text: "Rewritten", heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
    new Paragraph({ text: rewrite.rewrittenText }),
    new Paragraph({
      children: [new TextRun({ text: rewrite.changesSummary, italics: true, color: "666666" })],
      spacing: { before: 150 },
    })
  );

  if (includeAnalysis) {
    children.push(
      new Paragraph({ text: "Analysis", heading: HeadingLevel.HEADING_1, spacing: { before: 300 } }),
      new Paragraph({ text: `Grammar score: ${rewrite.grammar.score}/100` }),
      new Paragraph({ text: `Flesch Reading Ease: ${rewrite.readability.fleschReadingEase}` }),
      new Paragraph({ text: `Flesch-Kincaid Grade: ${rewrite.readability.fleschKincaidGrade}` }),
      new Paragraph({ text: `Clarity score: ${rewrite.readability.clarityScore}/100` }),
      new Paragraph({ text: `Professionalism score: ${rewrite.readability.professionalismScore}/100` }),
      new Paragraph({
        text: `Detected tone: ${rewrite.toneProfile.detectedTone} (formality ${rewrite.toneProfile.formalityScore}/100)`,
      })
    );
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}
