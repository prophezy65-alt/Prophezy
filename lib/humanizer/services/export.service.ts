// lib/humanizer/services/export.service.ts
import type { Rewrite, HumanizerExportRequest, HumanizerExportResult } from "../models/types";
import { exportToMarkdown, exportToHtml, exportToTxt, exportToJson } from "../export/text-formats.export";
import { exportToDocx } from "../export/docx.export";
import { exportToPdf } from "../export/pdf.export";
import { sanitizeFileName, mimeTypeForFormat, fileExtensionForFormat } from "../utils/export-utility";

export async function exportRewrite(rewrite: Rewrite, request: HumanizerExportRequest): Promise<HumanizerExportResult> {
  const baseName = sanitizeFileName(`${rewrite.options.style}-rewrite-${rewrite.id.slice(0, 8)}`);
  const fileName = `${baseName}.${fileExtensionForFormat(request.format)}`;
  const mimeType = mimeTypeForFormat(request.format);

  const buffer = await renderBuffer(rewrite, request);

  return { format: request.format, fileName, mimeType, buffer };
}

async function renderBuffer(rewrite: Rewrite, request: HumanizerExportRequest): Promise<Buffer> {
  switch (request.format) {
    case "markdown":
      return Buffer.from(exportToMarkdown(rewrite, request.includeOriginal, request.includeAnalysis), "utf-8");
    case "html":
      return Buffer.from(exportToHtml(rewrite, request.includeOriginal, request.includeAnalysis), "utf-8");
    case "txt":
      return Buffer.from(exportToTxt(rewrite, request.includeOriginal), "utf-8");
    case "json":
      return Buffer.from(exportToJson(rewrite, request.includeOriginal, request.includeAnalysis), "utf-8");
    case "docx":
      return exportToDocx(rewrite, request.includeOriginal, request.includeAnalysis);
    case "pdf":
      return exportToPdf(rewrite, request.includeOriginal, request.includeAnalysis);
  }
}
