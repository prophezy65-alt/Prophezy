/**
 * lib/flashcards/providers/ocr.provider.ts
 *
 * REWRITTEN: was `throw new Error("not implemented")` with a documented
 * ACTION NEEDED comment. Now a real wrapper over the actual
 * lib/ai/services/ocr.service.ts#ocrImage — public interface (OcrInput /
 * OcrResult / runOcr) unchanged, so ingestion.provider.ts's call site
 * didn't need to change at all.
 */

import { ocrImage } from "@/lib/ai/services/ocr.service";
import { fetchUploadBuffer } from "./upload-fetch.provider";

export interface OcrInput {
  /** uploads.id (uuid), per Uploads (0005). */
  fileRef: string;
  mimeType: "image/png" | "image/jpeg" | "application/pdf";
  userId: string;
}

export interface OcrResult {
  text: string;
  confidence: number; // 0..1 (ocrImage reports 0-100; normalized here)
  usedFallback: boolean;
}

export async function runOcr(input: OcrInput): Promise<OcrResult> {
  const { buffer } = await fetchUploadBuffer(input.fileRef, input.userId);
  const result = await ocrImage(input.userId, buffer, {});

  return {
    text: result.cleanedText,
    confidence: result.rawConfidence / 100,
    usedFallback: result.usedVisionFallback,
  };
}
