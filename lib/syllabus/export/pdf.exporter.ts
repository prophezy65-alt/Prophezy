/**
 * lib/syllabus/export/pdf.exporter.ts
 *
 * Converts the markdown rendering of a resource into a real PDF
 * buffer using the same line-based approach as the DOCX exporter,
 * via pdfkit. Tables render as simple aligned text rows rather than
 * true ruled tables — sufficient for a study-notes/export use case
 * without pulling in a heavier PDF-table library.
 *
 * Requires: npm install pdfkit @types/pdfkit
 */

import PDFDocument from 'pdfkit';
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

export async function renderResourceToPdf(resource: ExportableResource): Promise<Buffer> {
  const markdown = renderResourceToMarkdown(resource);
  const lines = markdown.split('\n');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const line of lines) {
      if (isTableRow(line)) {
        if (!isTableDivider(line)) {
          const cells = parseTableRow(line);
          doc.fontSize(10).text(cells.join('   |   '));
        }
        continue;
      }
      if (line.startsWith('# ')) {
        doc.fontSize(20).text(line.slice(2), { underline: true }).moveDown(0.5);
      } else if (line.startsWith('## ')) {
        doc.fontSize(16).text(line.slice(3)).moveDown(0.3);
      } else if (line.startsWith('### ')) {
        doc.fontSize(13).text(line.slice(4)).moveDown(0.2);
      } else if (line.startsWith('- ')) {
        doc.fontSize(11).text(`•  ${line.slice(2)}`, { indent: 15 });
      } else if (line.trim().length === 0) {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(11).text(line.replace(/\*\*/g, ''));
      }
    }

    doc.end();
  });
}
