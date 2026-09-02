// lib/assignment/utils/export-utility.ts
// Shared, format-agnostic helpers used by every exporter in lib/assignment/export/.

export function toCsvRow(values: (string | number | boolean | null)[]): string {
  return values.map(csvEscapeCell).join(",");
}

function csvEscapeCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: (string | number | boolean | null)[][]): string {
  const lines = [toCsvRow(headers), ...rows.map(toCsvRow)];
  return lines.join("\n");
}

export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9-_ .]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

export function mimeTypeForFormat(format: "pdf" | "docx" | "markdown" | "html" | "json" | "csv"): string {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "markdown":
      return "text/markdown";
    case "html":
      return "text/html";
    case "json":
      return "application/json";
    case "csv":
      return "text/csv";
  }
}

export function fileExtensionForFormat(format: "pdf" | "docx" | "markdown" | "html" | "json" | "csv"): string {
  switch (format) {
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "markdown":
      return "md";
    case "html":
      return "html";
    case "json":
      return "json";
    case "csv":
      return "csv";
  }
}
