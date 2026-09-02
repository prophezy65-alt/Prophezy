// lib/assignment/services/ocr.service.ts
//
// Two-stage OCR, matching the pattern already established in the AI Core
// Engine's own README ("ocr.service.ts — Two-stage: Tesseract.js extracts
// raw text, cleanup pass structures it. Falls back to a Gemini cleanup pass
// (native multimodal input) when Tesseract confidence is low."):
//
//   Stage 1 — Tesseract.js runs locally (cheap, fast, no AI cost) and
//             produces raw text + a confidence score.
//   Stage 2 — The raw text (or, if confidence is too low, the raw image
//             bytes) is sent through runAssignmentPrompt(ocrCleanupPrompt, ...)
//             which flows through the Core Engine — never a direct Gemini call.
//
// This keeps AI spend proportional to actual OCR difficulty: a clean
// born-digital scan barely touches the AI budget, while a messy handwritten
// page gets the full vision-model treatment.

import { createWorker } from "tesseract.js";
import type {
  StructuredExtraction,
  ExtractedPage,
  ExtractedTable,
  ExtractedEquation,
  ExtractedFigure,
} from "../models/types";
import { ocrCleanupPrompt } from "../prompts/ocr";
import { runAssignmentPrompt, AssignmentAiError } from "../providers/ai-engine.provider";
import { extractMarkdownTables, extractAlignedTables } from "../utils/table-parser";
import { extractEquations } from "../utils/equation-parser";

const TESSERACT_CONFIDENCE_THRESHOLD = 65; // 0-100 scale from Tesseract; below this we invoke vision fallback

export interface OcrPageInput {
  pageNumber: number;
  imageBuffer: Buffer;
  mimeType: string;
}

export interface RunOcrOptions {
  userId: string;
  fileId: string;
  /** Skip the Tesseract pass entirely and go straight to vision — used for
   * pages we already know are handwritten (e.g. flagged by the user). */
  forceVision?: boolean;
}

/** Runs the full two-stage OCR pipeline over one or more page images and
 * returns a single StructuredExtraction for the source file. */
export async function runOcrPipeline(
  pages: OcrPageInput[],
  options: RunOcrOptions
): Promise<StructuredExtraction> {
  const extractedPages: ExtractedPage[] = [];
  const allTables: ExtractedTable[] = [];
  const allEquations: ExtractedEquation[] = [];
  const allFigures: ExtractedFigure[] = [];
  const warnings: string[] = [];
  let anyHandwriting = false;
  let detectedLanguage = "en";

  const worker = options.forceVision ? null : await createWorker("eng");

  try {
    for (const page of pages) {
      const pageResult = await processSinglePage(page, worker, options, warnings);
      extractedPages.push(pageResult.page);
      allTables.push(...pageResult.tables);
      allEquations.push(...pageResult.equations);
      allFigures.push(...pageResult.figures);
      if (pageResult.hasHandwriting) anyHandwriting = true;
      if (pageResult.language) detectedLanguage = pageResult.language;
    }
  } finally {
    if (worker) await worker.terminate();
  }

  const fullText = extractedPages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((p) => p.rawText)
    .join("\n\n");

  return {
    fileId: options.fileId,
    pages: extractedPages,
    tables: allTables,
    equations: allEquations,
    figures: allFigures,
    fullText,
    language: detectedLanguage,
    hasHandwriting: anyHandwriting,
    extractionWarnings: warnings,
  };
}

interface SinglePageResult {
  page: ExtractedPage;
  tables: ExtractedTable[];
  equations: ExtractedEquation[];
  figures: ExtractedFigure[];
  hasHandwriting: boolean;
  language: string;
}

async function processSinglePage(
  page: OcrPageInput,
  worker: Awaited<ReturnType<typeof createWorker>> | null,
  options: RunOcrOptions,
  warnings: string[]
): Promise<SinglePageResult> {
  let tesseractText = "";
  let tesseractConfidence = 0;

  if (worker) {
    const { data } = await worker.recognize(page.imageBuffer);
    tesseractText = data.text.trim();
    tesseractConfidence = data.confidence; // 0-100
  }

  const needsVisionFallback = options.forceVision || tesseractConfidence < TESSERACT_CONFIDENCE_THRESHOLD || tesseractText.length < 10;

  if (!needsVisionFallback) {
    // High-confidence Tesseract result — still run the lightweight cleanup
    // pass (text mode, cheap on the Flash tier) to fix minor OCR noise and
    // pull out tables/equations/figures into structured form.
    try {
      const cleaned = await runAssignmentPrompt(
        ocrCleanupPrompt,
        { rawText: tesseractText, tesseractConfidence, mode: "text_cleanup" },
        { userId: options.userId }
      );
      return buildPageResult(page.pageNumber, cleaned, "ocr_tesseract", tesseractConfidence / 100);
    } catch (err) {
      warnings.push(pageWarning(page.pageNumber, err));
      // Degrade gracefully: return the raw Tesseract text unstructured
      // rather than failing the whole document.
      return {
        page: {
          pageNumber: page.pageNumber,
          rawText: tesseractText,
          confidence: tesseractConfidence / 100,
          source: "ocr_tesseract",
        },
        tables: extractMarkdownTables(tesseractText).length
          ? extractMarkdownTables(tesseractText)
          : extractAlignedTables(tesseractText),
        equations: extractEquations(tesseractText),
        figures: [],
        hasHandwriting: false,
        language: "en",
      };
    }
  }

  // Vision fallback: hand the raw image bytes to the Core Engine.
  try {
    const cleaned = await runAssignmentPrompt(
      ocrCleanupPrompt,
      { rawText: tesseractText, tesseractConfidence, mode: "vision" },
      {
        userId: options.userId,
        feature: "assignment_ocr_vision", // heavier vision call — separate Core Engine bucket from the text-cleanup pass
        imageBase64: page.imageBuffer.toString("base64"),
        imageMimeType: page.mimeType,
      }
    );
    return buildPageResult(page.pageNumber, cleaned, "ocr_gemini_vision", 0.85);
  } catch (err) {
    warnings.push(pageWarning(page.pageNumber, err));
    return {
      page: {
        pageNumber: page.pageNumber,
        rawText: tesseractText || "[extraction failed — page could not be processed]",
        confidence: tesseractText ? tesseractConfidence / 100 : 0,
        source: "ocr_gemini_vision",
      },
      tables: [],
      equations: [],
      figures: [],
      hasHandwriting: false,
      language: "en",
    };
  }
}

function buildPageResult(
  pageNumber: number,
  cleaned: Awaited<ReturnType<typeof runAssignmentPrompt<import("../prompts/ocr").OcrCleanupResponse>>>,
  source: ExtractedPage["source"],
  confidence: number
): SinglePageResult {
  return {
    page: { pageNumber, rawText: cleaned.cleanedText, confidence, source },
    tables: cleaned.tables.map((t, i) => ({
      id: `p${pageNumber}-tbl-${i}`,
      caption: t.caption ?? undefined,
      headers: t.headers,
      rows: t.rows,
      pageNumber,
    })),
    equations: cleaned.equations.map((e, i) => ({
      id: `p${pageNumber}-eq-${i}`,
      raw: e.raw,
      latex: e.latex ?? undefined,
      pageNumber,
    })),
    figures: cleaned.figures.map((f, i) => ({
      id: `p${pageNumber}-fig-${i}`,
      description: f.description,
      kind: (["diagram", "flowchart", "figure", "chart", "handwriting", "other"] as const).includes(
        f.kind as never
      )
        ? (f.kind as ExtractedFigure["kind"])
        : "other",
      pageNumber,
    })),
    hasHandwriting: cleaned.hasHandwriting,
    language: cleaned.language,
  };
}

function pageWarning(pageNumber: number, err: unknown): string {
  const message = err instanceof AssignmentAiError ? err.message : err instanceof Error ? err.message : "unknown error";
  return `Page ${pageNumber}: OCR structuring failed (${message}); returned best-effort raw text.`;
}
