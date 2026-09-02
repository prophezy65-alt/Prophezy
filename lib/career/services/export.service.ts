/**
 * export.service.ts
 * Assembles a full CareerReport from analytics + roadmap + recommendations
 * + skill gap + salary, then dispatches to the correct exporter — text
 * formats via utils/export-builder.ts, binary formats via export/*.ts.
 */

import { ExportFormat, ServiceResult, success, failure } from "../models/career.model";
import { CareerReport, exportCareerReport } from "../utils/export-builder";
import { generateCareerReportPdf } from "../export/career-pdf.export";
import { generateCareerReportDocx } from "../export/career-docx.export";

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
  async exportReport(report: CareerReport, format: ExportFormat): Promise<ServiceResult<ExportResult>> {
    try {
      if (format === "pdf") {
        const bytes = await generateCareerReportPdf(report);
        return success<ExportResult>({ format, mimeType: MIME_TYPES.pdf, content: bytes, fileExtension: "pdf" });
      }

      if (format === "docx") {
        const buffer = await generateCareerReportDocx(report);
        return success<ExportResult>({ format, mimeType: MIME_TYPES.docx, content: buffer, fileExtension: "docx" });
      }

      const { content } = exportCareerReport(report, format);
      return success<ExportResult>({
        format,
        mimeType: MIME_TYPES[format],
        content,
        fileExtension: format === "markdown" ? "md" : format,
      });
    } catch (error) {
      return failure("EXPORT_FAILED", `Failed to export career report as ${format}.`, (error as Error).message);
    }
  }
}
