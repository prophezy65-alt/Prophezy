/**
 * lib/notes/services/export.service.ts
 *
 * Export generated notes to every format the spec lists. Markdown/HTML/
 * JSON/TXT are free — they reuse formatter.service.ts, which already
 * builds them from any NoteGenerationOutput. PDF and DOCX are the two that
 * need real document-generation libraries:
 *
 *   npm install docx pdf-lib
 *
 * Both imports are function-scoped (dynamic `await import(...)`) rather
 * than top-level, so this module doesn't hard-fail to load in an
 * environment where those two packages aren't installed yet — every other
 * export format still works without them.
 */

import { toHtml, toJson, toMarkdown, toPlainText } from "./formatter.service";
import type { FlashcardsOutput, MindMapOutput, NoteGenerationOutput, NotesOutput } from "../models/types";

export type ExportFormat = "pdf" | "docx" | "markdown" | "html" | "json" | "csv" | "txt";

export interface ExportResult {
  format: ExportFormat;
  mimeType: string;
  /** Text formats return a string; binary formats (pdf/docx) return a Buffer. */
  data: string | Buffer;
  fileExtension: string;
}

function isProseNotes(output: NoteGenerationOutput): output is NotesOutput {
  return "topics" in output;
}

function isFlashcards(output: NoteGenerationOutput): output is FlashcardsOutput {
  return "cards" in output;
}

function isMindMap(output: NoteGenerationOutput): output is MindMapOutput {
  return "nodes" in output;
}

/** CSV rows: one row per definition, formula, and key point — the three "list of facts" shapes that map cleanly onto a spreadsheet. */
function toCsv(output: NoteGenerationOutput): string {
  const rows: string[][] = [["type", "primary", "secondary"]];

  if (isProseNotes(output)) {
    for (const d of output.definitions) rows.push(["definition", d.term, d.definition]);
    for (const f of output.formulas) rows.push(["formula", f.name, f.expression]);
    for (const kp of output.keyPoints) rows.push(["key_point", kp.text, kp.importance ?? ""]);
  } else if (isFlashcards(output)) {
    for (const c of output.cards) rows.push(["flashcard", c.front, c.back]);
  } else if (isMindMap(output)) {
    for (const n of output.nodes) rows.push(["node", n.label, n.parentId ?? ""]);
  }

  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escape).join(",")).join("\n");
}

/** Builds a minimal, valid DOCX from note content (headings + paragraphs + bullet lists). */
async function toDocx(output: NoteGenerationOutput, title: string): Promise<Buffer> {
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    TextRun,
  } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ];

  if (isProseNotes(output)) {
    children.push(new Paragraph({ text: output.overview }));
    for (const topic of output.topics) {
      children.push(new Paragraph({ text: topic.title, heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph({ text: topic.summary }));
      for (const sub of topic.subtopics ?? []) {
        children.push(new Paragraph({ text: sub.title, heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: sub.summary }));
        for (const kp of sub.keyPoints ?? []) {
          children.push(new Paragraph({ text: `• ${kp.text}` }));
        }
      }
    }
    if (output.definitions.length > 0) {
      children.push(new Paragraph({ text: "Definitions", heading: HeadingLevel.HEADING_1 }));
      for (const d of output.definitions) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${d.term}: `, bold: true }),
              new TextRun({ text: d.definition }),
            ],
          })
        );
      }
    }
  } else if (isFlashcards(output)) {
    for (const card of output.cards) {
      children.push(new Paragraph({ text: card.front, heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: card.back }));
    }
  } else if (isMindMap(output)) {
    children.push(new Paragraph({ text: "This note type is a diagram — see the Mermaid export or the app's mind map view for a visual rendering." }));
    for (const node of output.nodes) {
      children.push(new Paragraph({ text: `• ${node.label}` }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Builds a simple text-flow PDF from note content (title + wrapped paragraphs, one page per ~40 lines). */
async function toPdf(output: NoteGenerationOutput, title: string): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const fontSize = 11;
  const lineHeight = 16;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const wrapLine = (text: string, size: number, useFont: typeof font): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (useFont.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const drawLine = (text: string, size: number, useFont: typeof font) => {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(text, { x: margin, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  };

  const drawParagraph = (text: string, size = fontSize, useFont = font) => {
    for (const line of wrapLine(text, size, useFont)) drawLine(line, size, useFont);
    y -= 4;
  };

  drawParagraph(title, 18, boldFont);

  const markdown = toMarkdown(output);
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      y -= 6;
      continue;
    }
    if (line.startsWith("# ")) drawParagraph(line.slice(2), 16, boldFont);
    else if (line.startsWith("## ")) drawParagraph(line.slice(3), 13, boldFont);
    else if (line.startsWith("### ") || line.startsWith("#### "))
      drawParagraph(line.replace(/^#+\s*/, ""), 12, boldFont);
    else drawParagraph(line.replace(/^[-*]\s*/, "• "));
  }

  return Buffer.from(await pdfDoc.save());
}

export async function exportNotes(
  output: NoteGenerationOutput,
  format: ExportFormat
): Promise<ExportResult> {
  const title = "title" in output ? output.title : "Notes";

  switch (format) {
    case "markdown":
      return { format, mimeType: "text/markdown", fileExtension: "md", data: toMarkdown(output) };
    case "html":
      return { format, mimeType: "text/html", fileExtension: "html", data: toHtml(output) };
    case "json":
      return { format, mimeType: "application/json", fileExtension: "json", data: toJson(output) };
    case "txt":
      return { format, mimeType: "text/plain", fileExtension: "txt", data: toPlainText(output) };
    case "csv":
      return { format, mimeType: "text/csv", fileExtension: "csv", data: toCsv(output) };
    case "docx":
      return {
        format,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileExtension: "docx",
        data: await toDocx(output, title),
      };
    case "pdf":
      return {
        format,
        mimeType: "application/pdf",
        fileExtension: "pdf",
        data: await toPdf(output, title),
      };
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }
}
