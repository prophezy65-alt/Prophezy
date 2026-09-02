/**
 * lib/syllabus/export/docx.exporter.ts
 *
 * Converts the markdown rendering of a resource into a real .docx
 * buffer. Uses a line-based converter (headings -> Heading styles,
 * "- " lines -> bullet paragraphs, "| a | b |" lines -> table rows,
 * everything else -> body paragraphs) rather than a general-purpose
 * markdown-to-docx AST, since export output here is always produced
 * by our own markdown.exporter.ts and follows a small, known set of
 * patterns.
 *
 * Requires: npm install docx
 */

import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  TextRun,
} from 'docx';
import { renderResourceToMarkdown } from './markdown.exporter';
import type { ExportableResource } from '../models/syllabus.types';

function isTableRow(line: string): boolean {
  return /^\|.*\|$/.test(line.trim());
}

function isTableDivider(line: string): boolean {
  return /^\|[\s:-]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function linesToDocxElements(markdown: string): (Paragraph | Table)[] {
  const lines = markdown.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (isTableRow(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i]!)) {
        if (!isTableDivider(lines[i]!)) tableLines.push(lines[i]!);
        i++;
      }
      const rows = tableLines.map(parseTableRow);
      if (rows.length > 0) {
        elements.push(
          new Table({
            rows: rows.map(
              (cells, rowIndex) =>
                new TableRow({
                  children: cells.map(
                    (cell) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [new TextRun({ text: cell, bold: rowIndex === 0 })],
                          }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
        );
      }
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      elements.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      elements.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('- ')) {
      elements.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else if (line.trim().length === 0) {
      elements.push(new Paragraph({ text: '' }));
    } else {
      const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (boldMatch) {
        elements.push(
          new Paragraph({
            children: [
              new TextRun({ text: boldMatch[1], bold: true }),
              new TextRun({ text: boldMatch[2] }),
            ],
          }),
        );
      } else {
        elements.push(new Paragraph({ text: line }));
      }
    }
    i++;
  }

  return elements;
}

export async function renderResourceToDocx(resource: ExportableResource): Promise<Buffer> {
  const markdown = renderResourceToMarkdown(resource);
  const doc = new Document({
    sections: [{ children: linesToDocxElements(markdown) }],
  });
  return Packer.toBuffer(doc);
}
