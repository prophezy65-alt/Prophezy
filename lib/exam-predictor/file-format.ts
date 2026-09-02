/**
 * lib/exam-predictor/file-format.ts
 *
 * Exam Question Predictor is new — this file is new. It does not touch
 * lib/assignment/parser/file-router.ts (that dispatcher has its own
 * assignment-specific categories) or any Gemini/AI file. It only maps an
 * uploaded File to the `SyllabusSourceFormat` the EXISTING
 * `lib/syllabus/ingestion/ingestion.service.ts` already knows how to
 * ingest (pdf / docx / image / text) — no new extraction logic here.
 */

import type { SyllabusSourceFormat } from "@/lib/syllabus/models/syllabus.types";

export class UnsupportedExamPredictorFileError extends Error {
  constructor(fileName: string) {
    super(
      `"${fileName}" isn't a format I can read yet. Upload a PDF, DOCX, or image (PNG/JPG), or paste the text directly.`
    );
    this.name = "UnsupportedExamPredictorFileError";
  }
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export function detectSyllabusFormat(file: File): SyllabusSourceFormat {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";
  if (IMAGE_TYPES.has(type) || /\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (type.startsWith("text/") || name.endsWith(".txt")) return "text";

  throw new UnsupportedExamPredictorFileError(file.name);
}
