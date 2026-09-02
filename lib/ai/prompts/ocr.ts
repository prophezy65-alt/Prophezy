/**
 * lib/ai/prompts/ocr.ts
 *
 * This prompt does NOT perform OCR itself — raw text extraction is Tesseract's
 * job (see services/ocr.service.ts, which runs Tesseract first). This prompt
 * cleans up and structures Tesseract's noisy raw output, and can optionally
 * be swapped for Gemini's native vision input when Tesseract's confidence is
 * too low (handwriting, complex layouts).
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface OcrCleanupInput {
  rawOcrText: string;
  documentType?: "assignment" | "notes" | "resume" | "research-paper" | "unknown";
}

export interface OcrCleanupOutput {
  cleanedText: string;
  detectedType: string;
  lowConfidenceRegions: string[];
}

export const OCR_CLEANUP_PROMPT: PromptDefinition<OcrCleanupInput, OcrCleanupOutput> = {
  version: "ocr.v1",
  feature: "ocr",
  systemPrompt:
    "You clean up raw, noisy OCR output: fix obvious character-recognition " +
    "errors (rn -> m, 0 -> O, broken hyphenation across line breaks), restore " +
    "paragraph structure, and remove OCR artifacts (page numbers, scan noise, " +
    "watermark fragments). Do not invent content to fill gaps — if a region is " +
    "too garbled to confidently reconstruct, leave a placeholder and list it in " +
    "lowConfidenceRegions instead of guessing. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Expected document type: " + (input.documentType ?? "unknown"),
      wrapUserContent("raw_ocr_text", input.rawOcrText),
    ].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      cleanedText: { type: "string" },
      detectedType: { type: "string" },
      lowConfidenceRegions: { type: "array", items: { type: "string" } },
    },
    required: ["cleanedText", "detectedType", "lowConfidenceRegions"],
  },
  generation: { temperature: 0.2, maxOutputTokens: 4096 },
};
