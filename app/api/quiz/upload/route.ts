import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { documentService } from "@/lib/document/services/document.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // OCR + embedding can take a while for longer PDFs

const EXTENSION_TO_FORMAT: Record<string, string> = {
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  txt: "txt",
  md: "markdown",
  markdown: "markdown",
  csv: "csv",
  xlsx: "xlsx",
  json: "json",
  html: "html",
  ppt: "ppt",
  pptx: "pptx",
  png: "png",
  jpg: "jpg",
  jpeg: "jpeg",
  webp: "webp",
};

// POST /api/quiz/upload — reuses the shared document-intelligence pipeline
// (lib/document/services/document.service.ts) rather than duplicating
// upload/parse/OCR handling. Returns a document id usable as
// { sourceType: "upload", uploadId } when generating a quiz.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail(new Error("No file was uploaded."));
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const format = EXTENSION_TO_FORMAT[ext];
    if (!format) {
      return fail(new Error(`Unsupported file type ".${ext}". Try a PDF, Word doc, or image (PNG/JPG).`));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = ["png", "jpg", "jpeg", "webp"].includes(format);

    const document = await documentService.process({
      userId: user.id,
      ownerModule: "quiz",
      filename: file.name,
      format,
      buffer,
      mimeType: file.type || "application/octet-stream",
      runOcr: isImage, // scan images (and any empty/scanned PDF pages) via OCR
    });

    return ok({ documentId: document.id, filename: document.filename, chunkCount: document.chunks.length }, 201);
  } catch (error) {
    return fail(error);
  }
}
