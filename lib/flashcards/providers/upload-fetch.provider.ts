/**
 * lib/flashcards/providers/upload-fetch.provider.ts
 *
 * Shared "get me the raw bytes for this upload" helper used by both
 * ingestion.provider.ts (documentService.process needs a Buffer) and
 * ocr.provider.ts (ocrImage needs a Buffer). lib/storage/storage-service.ts
 * has upload/replace/delete/getSignedUrl but no download primitive, and
 * lib/document/services/document.service.ts's own callers are expected to
 * supply the buffer themselves — nothing in the codebase does this yet.
 * Kept local to Flashcards (reads the existing `uploads` table + Storage
 * directly) rather than adding a new export to shared storage
 * infrastructure, per "own only the Flashcards module."
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";

export interface FetchedUpload {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  filename: string;
}

/** uploadId is uploads.id (uuid) — same identifier /api/uploads/[id] already addresses files by. */
export async function fetchUploadBuffer(uploadId: string, userId: string): Promise<FetchedUpload> {
  const supabase = await getSupabaseServerClient();

  const { data: upload, error } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("user_id", userId)
    .single();

  if (error || !upload) {
    throw new Error(`upload-fetch.provider.ts: upload ${uploadId} not found (or not owned by this user).`);
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(upload.bucket_id)
    .download(upload.storage_path);

  if (downloadError || !blob) {
    throw new Error(
      `upload-fetch.provider.ts: failed to download upload ${uploadId}: ${downloadError?.message ?? "unknown error"}`
    );
  }

  const arrayBuffer = await blob.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: upload.file_type ?? "application/octet-stream",
    sizeBytes: upload.file_size_bytes ?? arrayBuffer.byteLength,
    filename: upload.file_name ?? "upload",
  };
}
