/**
 * lib/document/extractor/table-extractor.ts
 *
 * Fallback table detection for plain-text pages (e.g. a PDF page where
 * pdf-parse only gives flat text, no structure) — most providers
 * (xlsx/csv/html/markdown) already produce real TableBlocks natively; this
 * is a heuristic net for the ones that don't.
 */

import type { TableBlock } from "../models/content-block.model";

/** Detects consistently-delimited rows (tabs or 3+ spaces used as column separators). */
export function detectTablesInPlainText(text: string, pageIndex: number): TableBlock[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const tables: TableBlock[] = [];

  let currentRows: string[][] = [];
  let currentColCount = 0;

  const flush = () => {
    if (currentRows.length >= 2 && currentColCount >= 2) {
      tables.push({
        id: `detected_table_${tables.length}`,
        pageIndex,
        caption: null,
        headers: currentRows[0]!,
        rows: currentRows.slice(1),
        boundingBox: null,
      });
    }
    currentRows = [];
    currentColCount = 0;
  };

  for (const line of lines) {
    const cells = splitByDelimiter(line);
    if (cells.length >= 2 && (currentColCount === 0 || cells.length === currentColCount)) {
      currentColCount = cells.length;
      currentRows.push(cells);
    } else {
      flush();
    }
  }
  flush();

  return tables;
}

function splitByDelimiter(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((c) => c.trim()).filter(Boolean);
  }
  const spaceRunSplit = line.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean);
  return spaceRunSplit.length >= 2 ? spaceRunSplit : [line];
}
