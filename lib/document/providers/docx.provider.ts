/**
 * lib/document/providers/docx.provider.ts
 * Uses `mammoth` (in your stack) to convert DOCX -> HTML, which preserves
 * heading levels and lists far better than mammoth's raw-text mode — the
 * HTML is then walked into Sections/Paragraphs/Headings.
 */

import mammoth from "mammoth";
import type { Page } from "../models/page.model";
import type { Section, Heading, Paragraph, ListBlock, SectionBlock } from "../models/section.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { ParsingError } from "../errors/document-errors";

export interface DocxParseResult {
  pages: Page[]; // DOCX has no fixed pagination pre-render; we synthesize one "page" of full text plus structured sections
  sections: Section[];
  metadata: DocumentMetadata;
  rawText: string;
}

const HEADING_TAG_TO_LEVEL: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6,
};

export async function parseDocx(buffer: Buffer, fileSizeBytes: number): Promise<DocxParseResult> {
  let html: string;
  let rawText: string;
  try {
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const textResult = await mammoth.extractRawText({ buffer });
    html = htmlResult.value;
    rawText = textResult.value;
  } catch (err) {
    throw new ParsingError("Failed to parse DOCX.", { cause: err instanceof Error ? err.message : String(err) });
  }

  const sections = htmlToSections(html);

  const wordCount = rawText.trim().length ? rawText.trim().split(/\s+/).length : 0;

  const pages: Page[] = [
    {
      index: 0,
      pageNumber: 1,
      text: rawText.trim(),
      wordCount,
      hasImages: /<img/i.test(html),
      hasTables: /<table/i.test(html),
      ocrApplied: false,
      ocrConfidence: null,
    },
  ];

  const firstHeading = sections.find((s) => s.heading)?.heading?.text ?? null;

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    title: firstHeading,
    pageCount: 1,
    wordCount,
    fileSizeBytes,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  return { pages, sections, metadata, rawText };
}

/** Minimal, dependency-free HTML walker — mammoth's output is well-formed enough not to need a full DOM parser. */
function htmlToSections(html: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  let order = 0;

  const blockRegex = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  const startNewSection = (heading: Heading | null) => {
    if (current) sections.push(current);
    current = { id: `sec_${order}`, heading, blocks: [], startPageIndex: 0, endPageIndex: 0, order: order++ };
  };

  startNewSection(null);

  while ((match = blockRegex.exec(html)) !== null) {
    const tag = match[1]!.toLowerCase();
    const innerHtml = match[2]!;
    const text = stripTags(innerHtml).trim();
    if (!text) continue;

    if (tag in HEADING_TAG_TO_LEVEL) {
      startNewSection({ level: HEADING_TAG_TO_LEVEL[tag]!, text, pageIndex: 0 });
      continue;
    }

    if (!current) startNewSection(null);

    if (tag === "li") {
      const lastBlock = current!.blocks[current!.blocks.length - 1];
      if (lastBlock && lastBlock.type === "list") {
        (lastBlock.data as ListBlock).items.push(text);
      } else {
        const block: SectionBlock = { type: "list", data: { ordered: false, items: [text], pageIndex: 0 } };
        current!.blocks.push(block);
      }
    } else {
      const paragraph: Paragraph = { text, pageIndex: 0, isQuote: false };
      current!.blocks.push({ type: "paragraph", data: paragraph });
    }
  }

  if (current) sections.push(current);
  return sections;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}
