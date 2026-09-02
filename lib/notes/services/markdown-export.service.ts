/**
 * lib/notes/services/markdown-export.service.ts
 *
 * lib/notes/services/export.service.ts exports the AI's structured
 * NoteGenerationOutput — great immediately after generation, but that
 * structure doesn't survive persistence (the real schema only stores
 * `content_md`, and users can hand-edit it afterward). This is the
 * companion for exporting a PERSISTED note: same output formats, same
 * "docx"/"pdf-lib" packages, driven by markdown text instead of the
 * structured object, so an export always reflects the note's current
 * (possibly edited) content rather than a stale generation-time snapshot.
 *
 * Reuses lib/ai/utils/formatter.ts's markdownToHtml/markdownToPlainText
 * (existing, shared) rather than re-implementing markdown conversion.
 */

import { markdownToHtml, markdownToPlainText } from "../../ai/utils/formatter";

export type NoteExportFormat = "markdown" | "html" | "txt" | "json" | "csv" | "docx" | "pdf";

export interface NoteExportResult {
  format: NoteExportFormat;
  mimeType: string;
  fileExtension: string;
  data: string | Buffer;
}

/** One row per markdown heading section — the closest tabular shape a freeform note has. */
function markdownToCsv(markdown: string, title: string): string {
  const rows: string[][] = [["section", "content"]];
  const lines = markdown.split("\n");
  let currentHeading = title;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join(" ").trim();
    if (text) rows.push([currentHeading, text]);
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1] ?? currentHeading;
    } else if (line.trim()) {
      buffer.push(line.trim());
    }
  }
  flush();

  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(escape).join(",")).join("\n");
}

/** Builds a DOCX from markdown: heading levels map to Word heading styles, everything else is a paragraph. */
async function markdownToDocx(markdown: string, title: string): Promise<Buffer> {
  const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");

  const headingLevels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = (headingMatch[1] ?? "#").length - 1;
      children.push(new Paragraph({ text: headingMatch[2] ?? "", heading: headingLevels[level] }));
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      children.push(new Paragraph({ text: `• ${bulletMatch[1] ?? ""}` }));
      continue;
    }

    children.push(new Paragraph({ text: line.replace(/^>\s?/, "").replace(/[*_`]/g, "") }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

/** Builds a simple text-flow PDF from markdown (title + wrapped paragraphs, paginated). */
async function markdownToPdf(markdown: string, title: string): Promise<Buffer> {
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
    else drawParagraph(line.replace(/^[-*]\s*/, "• ").replace(/[*_`]/g, ""));
  }

  return Buffer.from(await pdfDoc.save());
}

export async function exportNoteMarkdown(
  markdown: string,
  title: string,
  format: NoteExportFormat
): Promise<NoteExportResult> {
  switch (format) {
    case "markdown":
      return { format, mimeType: "text/markdown", fileExtension: "md", data: markdown };
    case "html":
      return { format, mimeType: "text/html", fileExtension: "html", data: markdownToHtml(markdown) };
    case "txt":
      return { format, mimeType: "text/plain", fileExtension: "txt", data: markdownToPlainText(markdown) };
    case "json":
      return {
        format,
        mimeType: "application/json",
        fileExtension: "json",
        data: JSON.stringify({ title, contentMd: markdown }, null, 2),
      };
    case "csv":
      return { format, mimeType: "text/csv", fileExtension: "csv", data: markdownToCsv(markdown, title) };
    case "docx":
      return {
        format,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileExtension: "docx",
        data: await markdownToDocx(markdown, title),
      };
    case "pdf":
      return {
        format,
        mimeType: "application/pdf",
        fileExtension: "pdf",
        data: await markdownToPdf(markdown, title),
      };
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported export format: ${_exhaustive}`);
    }
  }
}
