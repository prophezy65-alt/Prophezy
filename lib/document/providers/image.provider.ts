/**
 * lib/document/providers/image.provider.ts
 * Thin orchestration: enhance -> OCR -> single-page document. The heavy
 * lifting lives in ocr/image-enhance.ts (real, sharp-based) and
 * ocr/ocr.provider.ts (needs wiring — see that file's header comment).
 */

import sharp from "sharp";
import { enhanceForOcr } from "../ocr/image-enhance";
import { runOcr } from "../ocr/ocr.provider";
import type { Page } from "../models/page.model";
import type { DocumentMetadata } from "../models/metadata.model";
import { EMPTY_METADATA } from "../models/metadata.model";

export interface ImageParseResult {
  pages: Page[];
  metadata: DocumentMetadata;
}

export async function parseImage(
  buffer: Buffer,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
  fileSizeBytes: number,
  userId: string
): Promise<ImageParseResult> {
  const enhanced = await enhanceForOcr(buffer, { grayscale: true, denoise: true, autoCrop: true });

  const ocrMime = mimeType === "image/webp" ? "image/png" : mimeType; // OCR provider doesn't need to special-case webp once re-encoded to PNG by enhanceForOcr
  const ocr = await runOcr({ imageBuffer: enhanced.buffer, mimeType: ocrMime, userId });

  const wordCount = ocr.text.trim().length ? ocr.text.trim().split(/\s+/).length : 0;

  const pages: Page[] = [
    {
      index: 0,
      pageNumber: 1,
      text: ocr.text,
      wordCount,
      hasImages: true,
      hasTables: false,
      ocrApplied: true,
      ocrConfidence: ocr.confidence,
    },
  ];

  const meta = await sharp(buffer).metadata();

  const metadata: DocumentMetadata = {
    ...EMPTY_METADATA,
    pageCount: 1,
    wordCount,
    fileSizeBytes,
    mimeType,
    custom: {
      width: meta.width ?? null,
      height: meta.height ?? null,
      enhancementSteps: enhanced.appliedSteps,
      ocrUsedFallback: ocr.usedFallback,
      detectedLanguage: ocr.detectedLanguage,
    },
  };

  return { pages, metadata };
}
