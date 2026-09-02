/**
 * export.service.ts
 * Assembles a HackathonPrepReport and dispatches to the correct exporter —
 * text formats via utils/export-builder.ts, binary formats via export/*.ts.
 */

import { ExportFormat, ServiceResult, success, failure } from "../models/hackathon.model";
import { HackathonPrepReport, exportPrepReport } from "../utils/export-builder";
import { generateHackathonPrepPdf } from "../export/hackathon-pdf.export";
import { generateHackathonPrepDocx } from "../export/hackathon-docx.export";

export interface ExportResult {
  format: ExportFormat;
  mimeType: string;
  content: string | Uint8Array | Buffer;
  fileExtension: string;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  markdown: "text/markdown",
  html: "text/html",
  json: "application/json",
};

export class ExportService {
  async exportReport(report: HackathonPrepReport, format: ExportFormat): Promise<ServiceResult<ExportResult>> {
    try {
      if (format === "pdf") {
        const bytes = await generateHackathonPrepPdf(report);
        return success<ExportResult>({ format, mimeType: MIME_TYPES.pdf, content: bytes, fileExtension: "pdf" });
      }
      if (format === "docx") {
        const buffer = await generateHackathonPrepDocx(report);
        return success<ExportResult>({ format, mimeType: MIME_TYPES.docx, content: buffer, fileExtension: "docx" });
      }

      const { content } = exportPrepReport(report, format);
      return success<ExportResult>({
        format,
        mimeType: MIME_TYPES[format],
        content,
        fileExtension: format === "markdown" ? "md" : format,
      });
    } catch (error) {
      return failure("EXPORT_FAILED", `Failed to export hackathon prep report as ${format}.`, (error as Error).message);
    }
  }
}
