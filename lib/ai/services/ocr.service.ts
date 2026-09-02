/**
 * lib/ai/services/ocr.service.ts
 *
 * Two-stage OCR pipeline:
 *   1. Tesseract.js extracts raw text from an image/PDF page (cheap, local,
 *      no API cost).
 *   2. Gemini cleans up Tesseract's noisy output — fixes recognition errors,
 *      restores structure — via the ocr.ts prompt template.
 *
 * For handwriting or complex layouts where Tesseract's confidence is low,
 * call `ocrWithVisionFallback` instead, which sends the image directly to
 * Gemini's multimodal input rather than trusting Tesseract's guess.
 *
 * Requires: npm install tesseract.js
 */

import { createWorker } from "tesseract.js";
import { runStructured } from "./_run-structured";
import { OCR_CLEANUP_PROMPT, type OcrCleanupInput, type OcrCleanupOutput } from "../prompts/ocr";
import { type GeminiMessage } from "../config/client";
import { generateWithFallback } from "../config/provider-router";
import { logger } from "../utils/logger";

export interface OcrResult extends OcrCleanupOutput {
  rawConfidence: number; // Tesseract's average word confidence, 0-100
  usedVisionFallback: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 65;

/**
 * Extracts text from an image buffer via Tesseract, then runs it through the
 * Gemini cleanup prompt. Falls back to Gemini vision automatically if
 * Tesseract's confidence is too low to trust.
 */
export async function ocrImage(
  userId: string,
  imageBuffer: Buffer,
  opts: { documentType?: OcrCleanupInput["documentType"]; requestId?: string } = {}
): Promise<OcrResult> {
  const worker = await createWorker("eng");
  let rawText = "";
  let confidence = 0;

  try {
    const { data } = await worker.recognize(imageBuffer);
    rawText = data.text;
    confidence = data.confidence;
  } finally {
    await worker.terminate();
  }

  logger.info("ai.ocr.tesseract_complete", {
    requestId: opts.requestId,
    confidence,
    textLength: rawText.length,
  });

  if (confidence < LOW_CONFIDENCE_THRESHOLD || rawText.trim().length < 20) {
    logger.info("ai.ocr.falling_back_to_vision", { requestId: opts.requestId, confidence });
    const visionResult = await ocrWithVisionFallback(userId, imageBuffer, opts);
    return { ...visionResult, rawConfidence: confidence, usedVisionFallback: true };
  }

  const cleaned = await runStructured(OCR_CLEANUP_PROMPT, {
    userId,
    input: { rawOcrText: rawText, documentType: opts.documentType },
    requestId: opts.requestId,
  });

  return { ...cleaned, rawConfidence: confidence, usedVisionFallback: false };
}

/**
 * Sends the raw image directly to Gemini's multimodal input instead of
 * relying on Tesseract — used for handwriting, dense tables, or any layout
 * Tesseract can't reliably parse.
 */
export async function ocrWithVisionFallback(
  _userId: string,
  imageBuffer: Buffer,
  opts: { documentType?: OcrCleanupInput["documentType"]; requestId?: string } = {}
): Promise<OcrCleanupOutput> {
  const messages: GeminiMessage[] = [
    {
      role: "user",
      parts: [
        {
          text:
            "Transcribe all text from this image exactly as written, preserving " +
            "structure (headings, bullet points, tables as markdown tables). If " +
            "handwriting is illegible, mark that span with [illegible] rather " +
            "than guessing.",
        },
        {
          inlineData: {
            mimeType: "image/png",
            data: imageBuffer.toString("base64"),
          },
        },
      ],
    },
  ];

  // Uses generateWithFallback() instead of calling generate() straight
  // against config/client.ts — this vision-cleanup call previously bypassed
  // engine.ts entirely (see README: OCR's own two-stage fallback), which
  // also meant it bypassed the Gemini->Grok fallback. Routed through the
  // same provider-router.ts everything else uses, so OCR gets covered too.
  const result = await generateWithFallback(messages, {
    model: "gemini-2.5-flash",
    temperature: 0.1,
    maxOutputTokens: 4096,
    requestId: opts.requestId,
    feature: "ocr",
  });

  return {
    cleanedText: result.text,
    detectedType: opts.documentType ?? "unknown",
    lowConfidenceRegions: [],
  };
}
