/**
 * lib/document/providers/html.provider.ts
 * Regex-based structural extraction (headings/paragraphs/lists/tables/
 * links/images), consistent with the lightweight approach used in
 * markdown.provider.ts and docx.provider.ts's HTML walker — avoids adding
 * a full DOM/JSDOM dependency for what's fundamentally the same block-level
 * walk as those two providers.
 */

import type { Page } from "../models/page.model";
import type { Section, Heading, Paragraph, SectionBlock } from "../models/section.model";
import type { TableBlock, Hyperlink } from "../models/content-block.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";

export interface HtmlParseResult {
  pages: Page[];
  sections: Section[];
  tables: TableBlock[];
  hyperlinks: Hyperlink[];
  metadata: DocumentMetadata;
}

export function parseHtml(html: string, fileSizeBytes: number): HtmlParseResult {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

  const sections: Section[] = [];
  let current: Section = { id: "sec_0", heading: null, blocks: [], startPageIndex: 0, endPageIndex: 0, order: 0 };
  let order = 1;

  const blockRegex = /<(h[1-6]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  const headingLevel: Record<string, Heading["level"]> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };

  while ((match = blockRegex.exec(body)) !== null) {
    const tag = match[1]!.toLowerCase();
    const text = stripTags(match[2]!).trim();
    if (!text) continue;

    if (tag in headingLevel) {
      if (current.blocks.length > 0 || current.heading) sections.push(current);
      current = { id: `sec_${order}`, heading: { level: headingLevel[tag]!, text, pageIndex: 0 }, blocks: [], startPageIndex: 0, endPageIndex: 0, order: order++ };
      continue;
    }

    const paragraph: Paragraph = { text, pageIndex: 0, isQuote: tag === "blockquote" };
    const block: SectionBlock = { type: "paragraph", data: paragraph };
    current.blocks.push(block);
  }
  sections.push(current);

  const tables = extractTables(body);
  const hyperlinks = extractLinks(body);

  const fullText = stripTags(body).replace(/\s+/g, " ").trim();
  const wordCount = fullText.length ? fullText.split(/\s+/).length : 0;

  const pages: Page[] = [
    { index: 0, pageNumber: 1, text: fullText, wordCount, hasImages: /<img/i.test(body), hasTables: tables.length > 0, ocrApplied: false, ocrConfidence: null },
  ];

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    title: titleMatch ? stripTags(titleMatch[1]!).trim() : null,
    pageCount: 1,
    wordCount,
    fileSizeBytes,
    mimeType: "text/html",
  };

  return { pages, sections, tables, hyperlinks, metadata };
}

function extractTables(html: string): TableBlock[] {
  const tables: TableBlock[] = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tMatch: RegExpExecArray | null;
  let idx = 0;

  while ((tMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tMatch[1]!;
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[][] = [];
    let rMatch: RegExpExecArray | null;

    while ((rMatch = rowRegex.exec(tableHtml)) !== null) {
      const cellRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
      const cells: string[] = [];
      let cMatch: RegExpExecArray | null;
      while ((cMatch = cellRegex.exec(rMatch[1]!)) !== null) {
        cells.push(stripTags(cMatch[1]!).trim());
      }
      if (cells.length) rows.push(cells);
    }

    if (rows.length > 0) {
      tables.push({ id: `table_${idx++}`, pageIndex: 0, caption: null, headers: rows[0]!, rows: rows.slice(1), boundingBox: null });
    }
  }

  return tables;
}

function extractLinks(html: string): Hyperlink[] {
  const links: Hyperlink[] = [];
  const linkRegex = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    links.push({ url: match[1]!, text: stripTags(match[2]!).trim(), pageIndex: 0 });
  }
  return links;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"');
}
