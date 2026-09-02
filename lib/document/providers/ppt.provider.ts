/**
 * lib/document/providers/ppt.provider.ts
 *
 * Your tech stack list (pdf-parse, mammoth, xlsx, csv-parser, sharp) has no
 * PPTX library, and per "Never duplicate parsing logic already available" /
 * "Reuse existing modules", PPTX text extraction should reuse whatever
 * Project Generator, Notes AI, or Syllabus AI already use for slide
 * uploads (the Flashcards Engine assumed the same reuse point, see
 * lib/flashcards/providers/ingestion.provider.ts). This file attempts that
 * reuse at runtime and fails loudly — with instructions — rather than
 * silently returning empty slide content or adding a brand-new pptx
 * dependency you didn't ask for.
 *
 * ACTION NEEDED: point `SHARED_PPTX_MODULE_PATH` at the real module, or
 * replace the body of `parsePptx` with a direct import once you share it.
 */

import type { Page } from "../models/page.model";
import type { Section, Heading, Paragraph } from "../models/section.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { NotWiredError } from "../errors/document-errors";

export interface PptxParseResult {
  pages: Page[]; // one Page per slide
  sections: Section[]; // one Section per slide, heading = slide title
  metadata: DocumentMetadata;
}

const SHARED_PPTX_MODULE_PATH = "@/lib/ai/utils/parser"; // same module flashcards assumed extractPptxText lives on

export async function parsePptx(buffer: Buffer, fileSizeBytes: number): Promise<PptxParseResult> {
  let extractSlides: ((buf: Buffer) => Promise<{ title: string | null; bulletText: string[] }[]>) | undefined;

  try {
    const mod: any = await import(SHARED_PPTX_MODULE_PATH);
    extractSlides = mod.extractPptxSlides;
  } catch {
    // module not found at that path — fall through to NotWiredError below
  }

  if (!extractSlides) {
    throw new NotWiredError(
      "ppt.provider.ts",
      `no PPTX slide extractor found at ${SHARED_PPTX_MODULE_PATH} — point extractSlides at whatever ` +
        "Project Generator / Notes AI / Syllabus AI already use to read .ppt/.pptx uploads."
    );
  }

  const slides = await extractSlides(buffer);

  const pages: Page[] = slides.map((slide, i) => {
    const text = [slide.title, ...slide.bulletText].filter(Boolean).join("\n");
    const wordCount = text.trim().length ? text.trim().split(/\s+/).length : 0;
    return {
      index: i,
      pageNumber: i + 1,
      text,
      wordCount,
      hasImages: false,
      hasTables: false,
      ocrApplied: false,
      ocrConfidence: null,
    };
  });

  const sections: Section[] = slides.map((slide, i) => {
    const heading: Heading | null = slide.title ? { level: 2, text: slide.title, pageIndex: i } : null;
    const paragraphs: Paragraph[] = slide.bulletText.map((t) => ({ text: t, pageIndex: i, isQuote: false }));
    return {
      id: `slide_${i}`,
      heading,
      blocks: paragraphs.map((p) => ({ type: "paragraph" as const, data: p })),
      startPageIndex: i,
      endPageIndex: i,
      order: i,
    };
  });

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    title: slides[0]?.title ?? null,
    pageCount: slides.length,
    wordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
    fileSizeBytes,
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  return { pages, sections, metadata };
}
