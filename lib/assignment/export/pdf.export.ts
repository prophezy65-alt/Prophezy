// lib/assignment/export/pdf.export.ts
//
// Peer dependency: npm install pdf-lib
//
// pdf-lib has no built-in rich-text/word-wrap layout engine, so this module
// implements a small manual text-flow layer: wrapText() measures string
// width against the loaded font at a given size and breaks lines to fit the
// page's content width; PdfCursor tracks the current write position and
// automatically starts a new page when content would overflow.

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import type { ExportableAssignment } from "./exportable-content";

const PAGE_WIDTH = 595.28; // A4 at 72dpi
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function exportToPdf(bundle: ExportableAssignment): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const cursor = new PdfCursor(pdfDoc, regularFont);

  cursor.writeText(bundle.document.title, { font: boldFont, size: 20 });
  cursor.writeText(
    `Subject: ${bundle.document.detectedSubjectArea} · ${bundle.document.questions.length} question(s)`,
    { font: italicFont, size: 10, color: rgb(0.4, 0.4, 0.4) }
  );
  cursor.addGap(10);

  for (const question of bundle.document.questions) {
    const marksSuffix = question.marks !== null ? ` [${question.marks} marks]` : "";
    cursor.addGap(14);
    cursor.writeText(`Q${question.questionNumber}. ${question.cleanedText}${marksSuffix}`, {
      font: boldFont,
      size: 13,
    });
    cursor.writeText(`${question.type} · ${question.difficulty} · ${question.topic}`, {
      font: italicFont,
      size: 9,
      color: rgb(0.5, 0.5, 0.5),
    });

    if (bundle.includeSolutions) {
      const solution = bundle.solutions.get(question.id);
      if (solution) {
        cursor.addGap(6);
        cursor.writeText("Understanding the question:", { font: boldFont, size: 11 });
        cursor.writeText(solution.explanationOfQuestion, { font: regularFont, size: 11 });
        cursor.writeText("Approach:", { font: boldFont, size: 11 });
        cursor.writeText(solution.approach, { font: regularFont, size: 11 });

        solution.steps.forEach((step) => {
          cursor.writeText(`${step.stepNumber}. ${step.title}`, { font: boldFont, size: 11 });
          cursor.writeText(step.explanation, { font: regularFont, size: 11 });
          if (step.formula) cursor.writeText(step.formula, { font: monoFont, size: 10 });
          if (step.code) cursor.writeText(step.code, { font: monoFont, size: 9 });
        });

        cursor.writeText("Final answer:", { font: boldFont, size: 11 });
        cursor.writeText(solution.finalAnswer, { font: regularFont, size: 11 });

        if (bundle.includeReferences && solution.references.length > 0) {
          cursor.writeText("References:", { font: boldFont, size: 10 });
          solution.references.forEach((ref, i) => {
            cursor.writeText(`${i + 1}. ${ref.citationText}`, { font: regularFont, size: 9 });
          });
        }
      }
    }
  }

  if (bundle.includeQuizzes && bundle.quiz.length > 0) {
    cursor.addGap(20);
    cursor.writeText("Quiz", { font: boldFont, size: 16 });
    bundle.quiz.forEach((q, i) => {
      cursor.writeText(`${i + 1}. ${q.prompt}`, { font: regularFont, size: 11 });
      if (q.options) {
        q.options.forEach((opt, oi) => {
          cursor.writeText(`   ${String.fromCharCode(65 + oi)}. ${opt}`, { font: regularFont, size: 10 });
        });
      }
      cursor.writeText(`Answer: ${q.correctAnswer} — ${q.explanation}`, {
        font: italicFont,
        size: 9,
        color: rgb(0.29, 0.42, 0.97),
      });
    });
  }

  if (bundle.includeFlashcards && bundle.flashcards.length > 0) {
    cursor.addGap(20);
    cursor.writeText("Flashcards", { font: boldFont, size: 16 });
    bundle.flashcards.forEach((c, i) => {
      cursor.writeText(`${i + 1}. Q: ${c.front}`, { font: regularFont, size: 10 });
      cursor.writeText(`   A: ${c.back}`, { font: regularFont, size: 10 });
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// pdf-lib's built-in fonts (Helvetica, Courier, etc.) only support WinAnsi
// encoding — essentially Latin-1. AI-generated solutions routinely contain
// Greek letters and math symbols (γ, √, °, ×, ≤, →, etc.) from formulas,
// any one of which throws and kills the whole export the moment it's
// drawn. Map the common ones to safe ASCII equivalents and strip anything
// else outside WinAnsi's range, so a single unsupported character never
// crashes the export — worst case a formula reads slightly less prettily,
// instead of the export failing entirely.
const SYMBOL_REPLACEMENTS: Record<string, string> = {
  "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon",
  "θ": "theta", "λ": "lambda", "μ": "mu", "π": "pi", "ρ": "rho",
  "σ": "sigma", "τ": "tau", "φ": "phi", "ω": "omega", "Δ": "Delta",
  "Σ": "Sigma", "Ω": "Omega", "Φ": "Phi", "Ψ": "Psi", "Θ": "Theta",
  "√": "sqrt", "∞": "infinity", "≤": "<=", "≥": ">=", "≠": "!=",
  "≈": "~=", "×": "x", "÷": "/", "→": "->", "←": "<-", "∂": "d",
  "∑": "sum", "∫": "integral", "°": " deg", "±": "+/-", "·": "*",
  "…": "...", "–": "-", "—": "-", "’": "'", "‘": "'", "“": "\"", "”": "\"",
};

function sanitizeForWinAnsi(text: string): string {
  let result = "";
  for (const ch of text) {
    if (SYMBOL_REPLACEMENTS[ch] !== undefined) {
      result += SYMBOL_REPLACEMENTS[ch];
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    // WinAnsi covers 0x20-0x7E (basic Latin) and 0xA0-0xFF (Latin-1
    // supplement); anything outside that range gets dropped rather than
    // risk pdf-lib throwing on an unmapped glyph.
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      result += ch;
    }
  }
  return result;
}

interface WriteOptions {
  font: PDFFont;
  size: number;
  color?: ReturnType<typeof rgb>;
}

/** Tracks the current write position across pages, wrapping and paginating
 * text automatically. Kept intentionally simple (left-aligned, single
 * column) — sufficient for an academic Q&A export; a richer multi-column
 * layout would be a frontend/print-CSS concern, not this backend module's. */
class PdfCursor {
  private page: PDFPage;
  private y: number;
  private readonly lineHeightMultiplier = 1.35;

  constructor(private readonly doc: PDFDocument, private readonly defaultFont: PDFFont) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  addGap(amount: number): void {
    this.y -= amount;
    if (this.y < MARGIN) this.newPage();
  }

  writeText(text: string, options: WriteOptions): void {
    const safeText = sanitizeForWinAnsi(text);
    const lines = wrapText(safeText, options.font, options.size, CONTENT_WIDTH);
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
      const width = font.widthOfTextAtSize(candidate, size);
      if (width > maxWidth && currentLine.length > 0) {
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
