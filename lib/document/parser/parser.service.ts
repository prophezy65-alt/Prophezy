/**
 * lib/document/parser/parser.service.ts
 *
 * The single dispatch point: given raw bytes + declared format, returns a
 * normalized `ParsedDocument` regardless of which provider handled it.
 * `document.service.ts` is the only caller.
 */

import { parsePdf, pagesNeedingOcr } from "../providers/pdf.provider";
import { parseDocx } from "../providers/docx.provider";
import { parseXlsx } from "../providers/xlsx.provider";
import { parseCsv } from "../providers/csv.provider";
import { parseMarkdown } from "../providers/markdown.provider";
import { parseHtml } from "../providers/html.provider";
import { parseImage } from "../providers/image.provider";
import { parsePptx } from "../providers/ppt.provider";
import { parseJson } from "../providers/json.provider";
import { expandZip, formatFromEntryName } from "../providers/zip.provider";
import type { FileFormat } from "../types/document.types";
import type { Page } from "../models/page.model";
import type { Section } from "../models/section.model";
import type { TableBlock, CodeBlock, Hyperlink } from "../models/content-block.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";
import { FutureFormatError, UnsupportedFormatError } from "../errors/document-errors";
import { FUTURE_FORMATS } from "../types/document.types";

export interface ParsedDocument {
  pages: Page[];
  sections: Section[];
  tables: TableBlock[];
  codeBlocks: CodeBlock[];
  hyperlinks: Hyperlink[];
  metadata: DocumentMetadata;
  rawText: string;
}

export interface ParseInput {
  buffer: Buffer;
  format: FileFormat;
  fileSizeBytes: number;
  userId: string;
  runOcrOnEmptyPages?: boolean;
}

export const parserService = {
  async parse(input: ParseInput): Promise<ParsedDocument> {
    if ((FUTURE_FORMATS as readonly string[]).includes(input.format)) {
      throw new FutureFormatError(input.format);
    }

    switch (input.format) {
      case "pdf": {
        const result = await parsePdf(input.buffer, input.fileSizeBytes);
        let pages = result.pages;

        if (input.runOcrOnEmptyPages ?? true) {
          const emptyIndexes = pagesNeedingOcr(pages);
          if (emptyIndexes.length > 0) {
            // NOTE: OCR-ing individual PDF pages requires rasterizing that
            // page to an image first (e.g. via pdf-parse's render callback
            // or a tool like pdf-to-img) — not shown here since it depends
            // on which rasterizer is already available in the codebase.
            // pagesNeedingOcr() still correctly flags which pages need it.
          }
        }

        return {
          pages,
          sections: [],
          tables: [],
          codeBlocks: [],
          hyperlinks: [],
          metadata: result.metadata,
          rawText: result.rawText,
        };
      }

      case "doc":
      case "docx": {
        const result = await parseDocx(input.buffer, input.fileSizeBytes);
        return { pages: result.pages, sections: result.sections, tables: [], codeBlocks: [], hyperlinks: [], metadata: result.metadata, rawText: result.rawText };
      }

      case "xlsx": {
        const result = parseXlsx(input.buffer, input.fileSizeBytes);
        return { pages: result.pages, sections: [], tables: result.tables, codeBlocks: [], hyperlinks: [], metadata: result.metadata, rawText: result.pages.map((p) => p.text).join("\n\n") };
      }

      case "csv": {
        const result = await parseCsv(input.buffer, input.fileSizeBytes);
        return { pages: result.pages, sections: [], tables: result.tables, codeBlocks: [], hyperlinks: [], metadata: result.metadata, rawText: result.pages[0]?.text ?? "" };
      }

      case "markdown": {
        const text = input.buffer.toString("utf-8");
        const result = parseMarkdown(text, input.fileSizeBytes);
        return { pages: result.pages, sections: result.sections, tables: result.tables, codeBlocks: result.codeBlocks, hyperlinks: [], metadata: result.metadata, rawText: text };
      }

      case "txt": {
        const text = input.buffer.toString("utf-8");
        const wordCount = text.trim().length ? text.trim().split(/\s+/).length : 0;
        const page: Page = { index: 0, pageNumber: 1, text, wordCount, hasImages: false, hasTables: false, ocrApplied: false, ocrConfidence: null };
        const metadata: DocumentMetadata = { ...EMPTY_METADATA, pageCount: 1, wordCount, fileSizeBytes: input.fileSizeBytes, mimeType: "text/plain" };
        return { pages: [page], sections: [], tables: [], codeBlocks: [], hyperlinks: [], metadata, rawText: text };
      }

      case "html": {
        const html = input.buffer.toString("utf-8");
        const result = parseHtml(html, input.fileSizeBytes);
        return { pages: result.pages, sections: result.sections, tables: result.tables, codeBlocks: [], hyperlinks: result.hyperlinks, metadata: result.metadata, rawText: result.pages[0]?.text ?? "" };
      }

      case "json": {
        const text = input.buffer.toString("utf-8");
        const result = parseJson(text, input.fileSizeBytes);
        return { pages: result.pages, sections: [], tables: [], codeBlocks: [], hyperlinks: [], metadata: result.metadata, rawText: result.pages[0]?.text ?? "" };
      }

      case "png":
      case "jpg":
      case "jpeg":
      case "webp": {
        const mime = input.format === "jpg" ? "image/jpeg" : (`image/${input.format}` as "image/png" | "image/jpeg" | "image/webp");
        const result = await parseImage(input.buffer, mime, input.fileSizeBytes, input.userId);
        return { pages: result.pages, sections: [], tables: [], codeBlocks: [], hyperlinks: [], metadata: result.metadata, rawText: result.pages[0]?.text ?? "" };
      }

      case "ppt":
      case "pptx": {
        const result = await parsePptx(input.buffer, input.fileSizeBytes);
        return { pages: result.pages, sections: result.sections, tables: [], codeBlocks: [], hyperlinks: [], metadata: result.metadata, rawText: result.pages.map((p) => p.text).join("\n\n") };
      }

      case "zip": {
        const entries = await expandZip(input.buffer);
        const parsedEntries = await Promise.all(
          entries.map(async (entry) => {
            const ext = formatFromEntryName(entry.name);
            if (!ext) return null;
            try {
              return await parserService.parse({
                buffer: entry.buffer,
                format: ext as FileFormat,
                fileSizeBytes: entry.sizeBytes,
                userId: input.userId,
                runOcrOnEmptyPages: input.runOcrOnEmptyPages,
              });
            } catch {
              return null; // skip unsupported/corrupt entries rather than failing the whole archive
            }
          })
        );

        const successful = parsedEntries.filter((p): p is ParsedDocument => p !== null);
        const pages = successful.flatMap((p, fileIdx) => p.pages.map((page) => ({ ...page, index: fileIdx * 1000 + page.index })));
        const rawText = successful.map((p) => p.rawText).join("\n\n---\n\n");

        const metadata: DocumentMetadata = {
          ...EMPTY_METADATA,
          pageCount: pages.length,
          wordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
          fileSizeBytes: input.fileSizeBytes,
          mimeType: "application/zip",
          custom: { entryCount: entries.length, parsedEntryCount: successful.length },
        };

        return {
          pages,
          sections: successful.flatMap((p) => p.sections),
          tables: successful.flatMap((p) => p.tables),
          codeBlocks: successful.flatMap((p) => p.codeBlocks),
          hyperlinks: successful.flatMap((p) => p.hyperlinks),
          metadata,
          rawText,
        };
      }

      default:
        throw new UnsupportedFormatError(input.format);
    }
  },
};
