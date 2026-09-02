/**
 * lib/syllabus/export/export.service.ts
 *
 * Single entry point: exportResource(resource, format) -> ExportResult.
 * No AI call — pure formatting over already-generated data, so this
 * is fast and free to call as often as the user wants.
 */

import { renderResourceToMarkdown } from './markdown.exporter';
import { renderResourceToJson } from './json.exporter';
import { renderResourceToCsv } from './csv.exporter';
import { renderResourceToDocx } from './docx.exporter';
import { renderResourceToPdf } from './pdf.exporter';
import type { ExportableResource, ExportFormat, ExportResult } from '../models/syllabus.types';

const MIME_TYPES: Record<ExportFormat, string> = {
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

function fileNameFor(resource: ExportableResource, format: ExportFormat): string {
  const ext = format === 'markdown' ? 'md' : format;
  return `${resource.kind}-${Date.now()}.${ext}`;
}

export async function exportResource(
  resource: ExportableResource,
  format: ExportFormat,
): Promise<ExportResult> {
  let content: Buffer | string;

  switch (format) {
    case 'markdown':
      content = renderResourceToMarkdown(resource);
      break;
    case 'json':
      content = renderResourceToJson(resource);
      break;
    case 'csv':
      content = renderResourceToCsv(resource);
      break;
    case 'docx':
      content = await renderResourceToDocx(resource);
      break;
    case 'pdf':
      content = await renderResourceToPdf(resource);
      break;
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unsupported export format: ${exhaustiveCheck}`);
    }
  }

  return {
    format,
    fileName: fileNameFor(resource, format),
    mimeType: MIME_TYPES[format],
    content,
  };
}
