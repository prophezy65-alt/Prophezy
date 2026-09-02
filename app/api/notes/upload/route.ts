import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createUpload } from "@/lib/storage/uploads-repository";
import { StorageError } from "@/lib/storage/errors";
import { parserService } from "@/lib/document/parser/parser.service";
import { UnsupportedFormatError, ParsingError } from "@/lib/document/errors/document-errors";
import type { FileFormat } from "@/lib/document/types/document.types";

/**
 * Maps the MIME types allowed by the "notes" upload category
 * (lib/storage/validation.ts) to the Document Intelligence Engine's
 * FileFormat. Only text-layer formats are supported here — image/scanned
 * uploads aren't accepted by the "notes" category in the first place,
 * since lib/document's OCR provider isn't wired to a real OCR service yet
 * (see lib/document/ocr/ocr.provider.ts).
 */
const MIME_TO_FORMAT: Record<string, FileFormat> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * POST /api/notes/upload — accepts a multipart file upload, stores it
 * (reusing the existing uploads pipeline), and extracts plain text from it
 * (reusing the existing Document Intelligence Engine's parser) so the
 * frontend can hand that text straight to POST /api/notes as `sourceText`.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const format = MIME_TO_FORMAT[file.type];
  if (!format) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Upload a PDF, DOCX, TXT, or Markdown file, or paste text directly.` },
      { status: 415 }
    );
  }

  try {
    const upload = await createUpload({ userId: user.id, file, category: "notes" });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parserService.parse({
      buffer,
      format,
      fileSizeBytes: file.size,
      userId: user.id,
    });

    if (!parsed.rawText.trim()) {
      return NextResponse.json(
        { error: "No text could be extracted from this file. Try a different file or paste the text directly." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      uploadId: upload.id,
      sourceKind: format,
      sourceText: parsed.rawText,
      sourceTitle: parsed.metadata.title ?? file.name,
    });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof UnsupportedFormatError || err instanceof ParsingError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/notes/upload failed", err);
    return NextResponse.json({ error: `Failed to process the uploaded file: ${message}` }, { status: 500 });
  }
}
