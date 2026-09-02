/**
 * lib/document/providers/xlsx.provider.ts
 * Uses `xlsx` (SheetJS, in your stack). Each sheet becomes one Page (for
 * pagination consistency with other providers) and one TableBlock.
 */

import * as XLSX from "xlsx";
import type { Page } from "../models/page.model";
import type { TableBlock } from "../models/content-block.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { ParsingError } from "../errors/document-errors";

export interface XlsxParseResult {
  pages: Page[];
  tables: TableBlock[];
  metadata: DocumentMetadata;
}

export function parseXlsx(buffer: Buffer, fileSizeBytes: number): XlsxParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    throw new ParsingError("Failed to parse XLSX.", { cause: err instanceof Error ? err.message : String(err) });
  }

  const pages: Page[] = [];
  const tables: TableBlock[] = [];

  workbook.SheetNames.forEach((sheetName, i) => {
    const sheet = workbook.Sheets[sheetName]!;
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

    const headers = (rows[0] ?? []).map(String);
    const bodyRows = rows.slice(1).map((r) => r.map(String));

    const flatText = rows.map((r) => r.join(" \t ")).join("\n");
    const wordCount = flatText.trim().length ? flatText.trim().split(/\s+/).length : 0;

    pages.push({
      index: i,
      pageNumber: i + 1,
      text: `Sheet: ${sheetName}\n${flatText}`,
      wordCount,
      hasImages: false,
      hasTables: rows.length > 0,
      ocrApplied: false,
      ocrConfidence: null,
    });

    if (rows.length > 0) {
      tables.push({
        id: `table_${i}`,
        pageIndex: i,
        caption: sheetName,
        headers,
        rows: bodyRows,
        boundingBox: null,
      });
    }
  });

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    pageCount: pages.length,
    wordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
    fileSizeBytes,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    custom: { sheetNames: workbook.SheetNames },
  };

  return { pages, tables, metadata };
}
