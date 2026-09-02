/**
 * lib/document/services/export.service.ts
 */

import { validationService } from "./validation.service";
import { DocumentError, NotWiredError } from "../errors/document-errors";
import { toJson, toMarkdown, toTxt, toHtml, toCsv } from "../export/formatters";
import type { ProphezyDocument } from "../models/document.model";

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string;
}

export const exportService = {
  /** `loadDocument` is injected by document.service.ts to avoid a circular import (export -> document -> export). */
  async exportDocument(rawInput: unknown, loadDocument: (id: string) => Promise<ProphezyDocument | null>): Promise<ExportResult> {
    const input = validationService.validateExportRequest(rawInput);
    const doc = await loadDocument(input.documentId);
    if (!doc) throw new DocumentError("Document not found.", "NOT_FOUND", { documentId: input.documentId });

    const safeName = (doc.metadata.title ?? doc.filename).replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();

    switch (input.format) {
      case "json":
        return { filename: `${safeName}.json`, mimeType: "application/json", content: toJson(doc) };
      case "markdown":
        return { filename: `${safeName}.md`, mimeType: "text/markdown", content: toMarkdown(doc) };
      case "txt":
        return { filename: `${safeName}.txt`, mimeType: "text/plain", content: toTxt(doc) };
      case "html":
        return { filename: `${safeName}.html`, mimeType: "text/html", content: toHtml(doc) };
      case "csv":
        return { filename: `${safeName}.csv`, mimeType: "text/csv", content: toCsv(doc) };

      case "docx":
        throw new NotWiredError(
          "export.service.ts",
          "DOCX export should reuse the existing DOCX builder (Resume Studio / docx skill infra, per 'Reuse existing modules') " +
            "fed with toMarkdown(doc) or the structured sections directly — not implemented here as a placeholder."
        );

      case "pdf":
        throw new NotWiredError(
          "export.service.ts",
          "PDF export should reuse the existing PDF builder the same way, fed with toHtml(doc) or toMarkdown(doc) — " +
            "not implemented here as a placeholder."
        );

      default:
        throw new DocumentError("Unsupported export format.", "UNSUPPORTED_FORMAT", { format: input.format });
    }
  },
};
