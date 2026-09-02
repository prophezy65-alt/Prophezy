// lib/assignment/utils/table-parser.ts
// Deterministic parser for markdown-style and whitespace-aligned tables that
// may already be present in extracted text (e.g. from DOCX/TXT sources,
// or after the OCR cleanup prompt has already reconstructed a table into
// markdown). Complements — does not replace — the AI-driven table
// reconstruction in prompts/ocr.ts, which handles messier scanned tables.

import type { ExtractedTable } from "../models/types";

const MD_TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const MD_SEPARATOR_ROW = /^\s*\|?[\s:|-]+\|?\s*$/;

export function extractMarkdownTables(text: string, idPrefix = "tbl"): ExtractedTable[] {
  const lines = text.split("\n");
  const tables: ExtractedTable[] = [];
  let tableIndex = 0;

  let i = 0;
  while (i < lines.length) {
    if (MD_TABLE_ROW.test(lines[i]!) && i + 1 < lines.length && MD_SEPARATOR_ROW.test(lines[i + 1]!)) {
      const headerCells = splitRow(lines[i]!);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && MD_TABLE_ROW.test(lines[j]!)) {
        rows.push(splitRow(lines[j]!));
        j++;
      }
      tables.push({
        id: `${idPrefix}-${tableIndex++}`,
        headers: headerCells,
        rows,
      });
      i = j;
    } else {
      i++;
    }
  }

  return tables;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

/** Detects whitespace/tab-aligned tables common in plain-text exports of
 * spreadsheet-like data (e.g. copy-pasted from Excel into a TXT/DOCX). Uses
 * consistent multi-space column gaps as the delimiter heuristic. */
export function extractAlignedTables(text: string, idPrefix = "tbl-aligned"): ExtractedTable[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const candidateLines = lines.filter((l) => /\s{2,}/.test(l));
  if (candidateLines.length < 2) return [];

  const splitOnGaps = (line: string): string[] =>
    line.trim().split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);

  const columnCounts = candidateLines.map((l) => splitOnGaps(l).length);
  const mostCommonCount = mode(columnCounts);
  if (mostCommonCount < 2) return [];

  const consistentLines = candidateLines.filter((l) => splitOnGaps(l).length === mostCommonCount);
  if (consistentLines.length < 2) return [];

  const [headerLine, ...rowLines] = consistentLines;
  return [
    {
      id: `${idPrefix}-0`,
      headers: splitOnGaps(headerLine!),
      rows: rowLines.map(splitOnGaps),
    },
  ];
}

function mode(numbers: number[]): number {
  const counts = new Map<number, number>();
  for (const n of numbers) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
