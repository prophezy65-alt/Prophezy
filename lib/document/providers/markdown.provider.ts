/**
 * lib/document/providers/markdown.provider.ts
 *
 * Dependency-free markdown structural parser: headings -> Sections, fenced
 * code blocks -> CodeBlocks, pipe tables -> TableBlocks, bullet/numbered
 * lists -> ListBlocks. Handles the 80% of markdown that matters for
 * document intelligence without pulling in a full remark/unified pipeline.
 */

import type { Page } from "../models/page.model";
import type { Section, Heading, Paragraph, ListBlock, SectionBlock } from "../models/section.model";
import type { CodeBlock, TableBlock } from "../models/content-block.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";

export interface MarkdownParseResult {
  pages: Page[];
  sections: Section[];
  codeBlocks: CodeBlock[];
  tables: TableBlock[];
  metadata: DocumentMetadata;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const CODE_FENCE_RE = /^```(\w*)\s*$/;
const TABLE_ROW_RE = /^\|(.+)\|$/;
const TABLE_SEPARATOR_RE = /^\|?[\s:|-]+\|?$/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+\.)\s+(.+)$/;

export function parseMarkdown(text: string, fileSizeBytes: number): MarkdownParseResult {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  const codeBlocks: CodeBlock[] = [];
  const tables: TableBlock[] = [];

  let current: Section = { id: "sec_0", heading: null, blocks: [], startPageIndex: 0, endPageIndex: 0, order: 0 };
  let order = 1;
  let inCodeFence = false;
  let codeLang: string | null = null;
  let codeBuffer: string[] = [];
  let pendingTableRows: string[] = [];
  let listBuffer: ListBlock | null = null;

  const flushList = () => {
    if (listBuffer && listBuffer.items.length > 0) current.blocks.push({ type: "list", data: listBuffer });
    listBuffer = null;
  };

  const flushTable = () => {
    if (pendingTableRows.length >= 2) {
      const headerCells = splitTableRow(pendingTableRows[0]!);
      const bodyRows = pendingTableRows.slice(2).map(splitTableRow);
      tables.push({
        id: `table_${tables.length}`,
        pageIndex: 0,
        caption: null,
        headers: headerCells,
        rows: bodyRows,
        boundingBox: null,
      });
    }
    pendingTableRows = [];
  };

  for (const rawLine of lines) {
    const line = rawLine;

    const fenceMatch = line.match(CODE_FENCE_RE);
    if (fenceMatch) {
      if (!inCodeFence) {
        inCodeFence = true;
        codeLang = fenceMatch[1] || null;
        codeBuffer = [];
      } else {
        inCodeFence = false;
        codeBlocks.push({
          id: `code_${codeBlocks.length}`,
          pageIndex: 0,
          language: codeLang,
          code: codeBuffer.join("\n"),
        });
      }
      continue;
    }

    if (inCodeFence) {
      codeBuffer.push(line);
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flushList();
      flushTable();
      if (current.blocks.length > 0 || current.heading) sections.push(current);
      const heading: Heading = { level: headingMatch[1]!.length as Heading["level"], text: headingMatch[2]!.trim(), pageIndex: 0 };
      current = { id: `sec_${order}`, heading, blocks: [], startPageIndex: 0, endPageIndex: 0, order: order++ };
      continue;
    }

    if (TABLE_ROW_RE.test(line) || TABLE_SEPARATOR_RE.test(line)) {
      pendingTableRows.push(line);
      continue;
    }
    if (pendingTableRows.length > 0) flushTable();

    const listMatch = line.match(LIST_ITEM_RE);
    if (listMatch) {
      const ordered = /^\d+\./.test(listMatch[2]!);
      if (!listBuffer) listBuffer = { ordered, items: [], pageIndex: 0 };
      listBuffer.items.push(listMatch[3]!.trim());
      continue;
    }
    if (listBuffer) flushList();

    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const isQuote = trimmed.startsWith(">");
    const paragraph: Paragraph = { text: isQuote ? trimmed.replace(/^>\s?/, "") : trimmed, pageIndex: 0, isQuote };
    current.blocks.push({ type: "paragraph", data: paragraph });
  }

  flushList();
  flushTable();
  sections.push(current);

  const fullText = sections
    .map((s) => [s.heading?.text, ...s.blocks.map((b) => (b.type === "paragraph" ? b.data.text : b.data.items.join("\n")))].filter(Boolean).join("\n"))
    .join("\n\n");

  const wordCount = fullText.trim().length ? fullText.trim().split(/\s+/).length : 0;

  const pages: Page[] = [
    { index: 0, pageNumber: 1, text: fullText, wordCount, hasImages: /!\[.*\]\(.*\)/.test(text), hasTables: tables.length > 0, ocrApplied: false, ocrConfidence: null },
  ];

  const firstHeading = sections.find((s) => s.heading)?.heading?.text ?? null;

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    title: firstHeading,
    pageCount: 1,
    wordCount,
    fileSizeBytes,
    mimeType: "text/markdown",
  };

  return { pages, sections, codeBlocks, tables, metadata };
}

function splitTableRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}
