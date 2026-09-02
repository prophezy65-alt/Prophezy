// lib/humanizer/export/pdf.export.ts
// Peer dependency: npm install pdf-lib (shared with lib/assignment/export/pdf.export.ts)

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import type { Rewrite } from "../models/types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function exportToPdf(rewrite: Rewrite, includeOriginal: boolean, includeAnalysis: boolean): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const cursor = new PdfCursor(pdfDoc);

  cursor.writeText(
    `Rewrite (${rewrite.options.style}${rewrite.options.tone ? `, ${rewrite.options.tone} tone` : ""})`,
    { font: bold, size: 18 }
  );
  cursor.addGap(10);

  if (includeOriginal) {
    cursor.writeText("Original", { font: bold, size: 13 });
    cursor.writeText(rewrite.originalText, { font: regular, size: 11 });
    cursor.addGap(10);
  }

  cursor.writeText("Rewritten", { font: bold, size: 13 });
  cursor.writeText(rewrite.rewrittenText, { font: regular, size: 11 });
  cursor.writeText(rewrite.changesSummary, { font: italic, size: 9, color: rgb(0.4, 0.4, 0.4) });

  if (includeAnalysis) {
    cursor.addGap(14);
    cursor.writeText("Analysis", { font: bold, size: 13 });
    cursor.writeText(`Grammar score: ${rewrite.grammar.score}/100`, { font: regular, size: 10 });
    cursor.writeText(`Flesch Reading Ease: ${rewrite.readability.fleschReadingEase}`, { font: regular, size: 10 });
    cursor.writeText(`Flesch-Kincaid Grade: ${rewrite.readability.fleschKincaidGrade}`, { font: regular, size: 10 });
    cursor.writeText(`Clarity score: ${rewrite.readability.clarityScore}/100`, { font: regular, size: 10 });
    cursor.writeText(`Professionalism score: ${rewrite.readability.professionalismScore}/100`, { font: regular, size: 10 });
    cursor.writeText(
      `Detected tone: ${rewrite.toneProfile.detectedTone} (formality ${rewrite.toneProfile.formalityScore}/100)`,
      { font: regular, size: 10 }
    );
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

interface WriteOptions {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
}

class PdfCursor {
  private page: PDFPage;
  private y: number;
  private readonly lineHeightMultiplier = 1.35;

  constructor(private readonly doc: PDFDocument) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  addGap(amount: number): void {
    this.y -= amount;
    if (this.y < MARGIN) this.newPage();
  }

  writeText(text: string, options: WriteOptions): void {
    const lines = wrapText(text, options.font, options.size, CONTENT_WIDTH);
    const lineHeight = options.size * this.lineHeightMultiplier;
    for (const line of lines) {
      if (this.y - lineHeight < MARGIN) this.newPage();
      this.page.drawText(line, {
        x: MARGIN,
        y: this.y - options.size,
        size: options.size,
        font: options.font,
        color: options.color ?? rgb(0, 0, 0),
      });
      this.y -= lineHeight;
    }
  }

  private newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);
  }
  return lines;
}
