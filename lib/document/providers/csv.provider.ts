/**
 * lib/document/providers/csv.provider.ts
 * Uses `csv-parser` (streaming, in your stack) so large CSVs don't need to
 * be fully buffered as strings before parsing.
 */

import { Readable } from "stream";
import csvParser from "csv-parser";
import type { Page } from "../models/page.model";
import type { TableBlock } from "../models/content-block.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { ParsingError } from "../errors/document-errors";

export interface CsvParseResult {
  pages: Page[];
  tables: TableBlock[];
  metadata: DocumentMetadata;
}

const MAX_ROWS = 50_000; // guard against pathological CSVs blowing memory downstream

export async function parseCsv(buffer: Buffer, fileSizeBytes: number): Promise<CsvParseResult> {
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      Readable.from(buffer)
        .pipe(csvParser())
        .on("headers", (h: string[]) => {
          headers = h;
        })
        .on("data", (row: Record<string, string>) => {
          if (rows.length < MAX_ROWS) rows.push(row);
        })
        .on("end", resolve)
        .on("error", reject);
    });
  } catch (err) {
    throw new ParsingError("Failed to parse CSV.", { cause: err instanceof Error ? err.message : String(err) });
  }

  const bodyRows = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
  const flatText = [headers.join(", "), ...bodyRows.map((r) => r.join(", "))].join("\n");
  const wordCount = flatText.trim().length ? flatText.trim().split(/\s+/).length : 0;

  const pages: Page[] = [
    {
      index: 0,
      pageNumber: 1,
      text: flatText,
      wordCount,
      hasImages: false,
      hasTables: true,
      ocrApplied: false,
      ocrConfidence: null,
    },
  ];

  const tables: TableBlock[] = [
    { id: "table_0", pageIndex: 0, caption: null, headers, rows: bodyRows, boundingBox: null },
  ];

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    pageCount: 1,
    wordCount,
    fileSizeBytes,
    mimeType: "text/csv",
    custom: { rowCount: rows.length, truncated: rows.length >= MAX_ROWS },
  };

  return { pages, tables, metadata };
}
