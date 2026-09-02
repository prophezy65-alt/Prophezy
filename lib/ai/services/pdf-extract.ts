/**
 * lib/ai/services/pdf-extract.ts
 *
 * Robust PDF text extraction using Gemini's native PDF understanding, instead
 * of `pdf-parse`/`pdfjs` (which fail to initialize inside Next's server
 * bundle — "Object.defineProperty called on non-object"). Gemini reads both
 * text-layer and scanned/image PDFs, so this doubles as an OCR path too.
 *
 * Used by the Notes document parser and the Resume importer.
 */
import "server-only";
import { type GeminiMessage } from "../config/client";
import { generateWithFallback } from "../config/provider-router";
import { resolveModelForFeature } from "../config/models";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const messages: GeminiMessage[] = [
    {
      role: "user",
      parts: [
        {
          text:
            "Transcribe ALL text from this PDF document exactly, preserving " +
            "structure (headings, bullet points, tables as markdown). Output only " +
            "the transcribed content — no commentary, no code fences.",
        },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        },
      ],
    },
  ];

  // generateWithFallback() instead of a direct generate() call — this
  // bypassed engine.ts (and therefore the Gemini->Grok fallback) before,
  // same as ocr.service.ts. Swapped for the same reason.
  const result = await generateWithFallback(messages, {
    model: resolveModelForFeature("ocr").id,
    temperature: 0.1,
    maxOutputTokens: 8192,
    feature: "ocr",
  });
  return result.text ?? "";
}
