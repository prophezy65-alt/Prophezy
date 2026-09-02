// lib/humanizer/utils/export-utility.ts
import type { HumanizerExportFormat } from "../models/types";

export function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9-_ .]/g, "").replace(/\s+/g, "_").slice(0, 120);
}

export function mimeTypeForFormat(format: HumanizerExportFormat): string {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "markdown":
      return "text/markdown";
    case "html":
      return "text/html";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
  }
}

export function fileExtensionForFormat(format: HumanizerExportFormat): string {
  switch (format) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "markdown":
      return "md";
    case "html":
      return "html";
    case "txt":
      return "txt";
    case "json":
      return "json";
  }
}
