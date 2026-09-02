// lib/assignment/services/export.service.ts
import type { ExportRequest, ExportResult } from "../models/types";
import type { ExportableAssignment } from "../export/exportable-content";
import { exportToMarkdown } from "../export/markdown.export";
import { exportToHtml } from "../export/html.export";
import { exportToJson, exportToCsv } from "../export/data.export";
import { exportToDocx } from "../export/docx.export";
import { exportToPdf } from "../export/pdf.export";
import { sanitizeFileName, mimeTypeForFormat, fileExtensionForFormat } from "../utils/export-utility";

export async function exportAssignment(bundle: ExportableAssignment, request: ExportRequest): Promise<ExportResult> {
  const baseName = sanitizeFileName(bundle.document.title || "assignment");
  const extension = fileExtensionForFormat(request.format);
  const fileName = `${baseName}.${extension}`;
  const mimeType = mimeTypeForFormat(request.format);

  const buffer = await renderBuffer(bundle, request);

  return { format: request.format, fileName, mimeType, buffer };
}

async function renderBuffer(bundle: ExportableAssignment, request: ExportRequest): Promise<Buffer> {
  switch (request.format) {
    case "markdown":
      return Buffer.from(exportToMarkdown(bundle), "utf-8");
    case "html":
      return Buffer.from(exportToHtml(bundle), "utf-8");
    case "json":
      return Buffer.from(exportToJson(bundle), "utf-8");
    case "csv":
      return Buffer.from(exportToCsv(bundle), "utf-8");
    case "docx":
      return exportToDocx(bundle);
    case "pdf":
      return exportToPdf(bundle);
  }
}

/** Builds the ExportableAssignment bundle from raw pieces the API route
 * already has in hand — kept as a plain function (not a class) since it's
 * pure assembly with no I/O of its own. */
export function buildExportableAssignment(
  document: ExportableAssignment["document"],
  solutions: ExportableAssignment["solutions"],
  quiz: ExportableAssignment["quiz"],
  flashcards: ExportableAssignment["flashcards"],
  request: Pick<ExportRequest, "includeSolutions" | "includeQuizzes" | "includeFlashcards" | "includeReferences">
): ExportableAssignment {
  return {
    document,
    solutions,
    quiz,
    flashcards,
    includeSolutions: request.includeSolutions,
    includeQuizzes: request.includeQuizzes,
    includeFlashcards: request.includeFlashcards,
    includeReferences: request.includeReferences,
  };
}
