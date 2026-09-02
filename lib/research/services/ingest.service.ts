/**
 * lib/research/services/ingest.service.ts
 *
 * PDF upload entry point for Research AI. Reuses two existing pipelines
 * rather than reimplementing either:
 *
 *   1. lib/storage/uploads-repository.ts — puts the raw file in Storage and
 *      records it in `uploads` (gives us a permanent, downloadable original).
 *   2. lib/document (Document Intelligence Engine) — parses, OCRs scanned
 *      pages, chunks, embeds, and indexes the text for RAG (semantic
 *      search / chat with documents).
 *
 * This service's only job is to run both and link the results into one
 * `research_papers` row.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createUpload, deleteUpload } from "@/lib/storage/uploads-repository";
import { documentService } from "@/lib/document";
import { ResearchError } from "../utils/errors";
import { researchLogger } from "../utils/logger";
import type { ResearchPaperInsert, ResearchPaperRow } from "../models/db.types";

export class ResearchIngestError extends ResearchError {
  constructor(message: string, cause?: unknown) {
    super(message, "RESEARCH_INGEST_ERROR", cause);
  }
}

export interface UploadPaperInput {
  userId: string;
  file: File;
}

const PDF_MIME_TYPES = new Set(["application/pdf"]);

/**
 * Uploads a PDF, processes it through the Document Intelligence Engine,
 * and creates the linked `research_papers` row. On any failure after the
 * storage upload succeeds, the orphaned upload is best-effort cleaned up
 * so a failed ingest doesn't leave a dangling file with nothing pointing
 * at it.
 *
 * ============================================================================
 * DEDUP FIX
 * ============================================================================
 * Previously this always ran the full OCR/chunk/embed pipeline and inserted
 * a new `research_papers` row, even if the exact same PDF had already been
 * uploaded — re-uploading the same file (a double-click on "Choose file",
 * testing, a mis-click) silently created a second identical library card
 * forever, with no bound on how many times. This checks for an existing
 * upload by the user with the same original filename *before* running the
 * (expensive) OCR pipeline; if one's already fully processed, its paper is
 * returned as-is instead of reprocessing. This is a filename match, not a
 * content hash — two genuinely different papers that happen to share a
 * filename (rare, but possible) would collide. If that turns out to matter
 * for you, the fix is a SHA-256 of the file bytes instead; say the word and
 * I'll wire that in — it just needs a column to store the hash in.
 */
export async function uploadPaper(input: UploadPaperInput): Promise<ResearchPaperRow> {
  const { userId, file } = input;

  if (!PDF_MIME_TYPES.has(file.type)) {
    throw new ResearchIngestError(`Unsupported file type "${file.type}". Only PDF is supported for paper upload.`);
  }

  const supabase = await createClient();

  const { data: existingByFilename, error: existingError } = await supabase
    .from("research_papers")
    .select("*, uploads!inner(filename)")
    .eq("user_id", userId)
    .eq("uploads.filename", file.name)
    .maybeSingle<ResearchPaperRow>();

  if (existingError) {
    // Non-fatal — a failed pre-check should never block a legitimate
    // upload, it just means this one run won't catch a duplicate.
    researchLogger.warn("ingest.dedup_check_failed", { userId, filename: file.name, error: existingError.message });
  }
  if (existingByFilename) {
    researchLogger.info("ingest.upload_already_exists", { userId, filename: file.name, paperId: existingByFilename.id });
    return existingByFilename;
  }

  researchLogger.info("ingest.upload_started", { userId, filename: file.name, sizeBytes: file.size });

  const upload = await createUpload({ userId, file, category: "research_paper" });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const document = await documentService.process({
      userId,
      ownerModule: "research",
      filename: file.name,
      format: "pdf",
      buffer,
      mimeType: file.type,
      chunkStrategy: "recursive",
      extractTables: true,
      extractTopics: true,
      runOcr: true,
    });

    const title = (document.metadata.title && document.metadata.title.trim()) || file.name.replace(/\.pdf$/i, "");
    const authors = document.metadata.authors ?? [];

    const insert: ResearchPaperInsert = {
      user_id: userId,
      upload_id: upload.id,
      document_id: document.id,
      title,
      authors,
      summary_md: document.summary,
      published_at: document.metadata.createdDate ?? null,
    };

    const { data, error } = await supabase
      .from("research_papers")
      .insert(insert)
      .select()
      .single<ResearchPaperRow>();

    if (error || !data) {
      throw new ResearchIngestError("Paper was processed but the research_papers record could not be created.", error?.message);
    }

    researchLogger.info("ingest.upload_completed", { userId, paperId: data.id, documentId: document.id });
    return data;
  } catch (err) {
    researchLogger.error("ingest.upload_failed", { userId, uploadId: upload.id, error: err instanceof Error ? err.message : String(err) });
    await deleteUpload(upload.id).catch(() => {
      // Best-effort cleanup; the original error is what the caller needs to see.
    });
    if (err instanceof ResearchError) throw err;
    throw new ResearchIngestError("Failed to process uploaded paper.", err instanceof Error ? err.message : String(err));
  }
}
