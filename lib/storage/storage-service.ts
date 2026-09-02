import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { StorageError } from "./errors";

/**
 * Generic, reusable storage primitives. Every category-specific service
 * (uploads, avatars, and whatever Phase 4+ needs) is built on top of these
 * four functions instead of calling supabase.storage directly — so there's
 * exactly one place that knows how to talk to Supabase Storage.
 */

export interface UploadResult {
  bucket: string;
  path: string;
}

export async function uploadFile(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean },
): Promise<UploadResult> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: options?.contentType,
    upsert: options?.upsert ?? false,
  });
  if (error) {
    throw new StorageError(`Upload to ${bucket}/${path} failed: ${error.message}`, "UPLOAD_FAILED");
  }
  return { bucket, path };
}

/** Same as uploadFile but always overwrites — used when replacing an
 *  existing file (e.g. a new avatar, a re-uploaded resume PDF). */
export async function replaceFile(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string },
): Promise<UploadResult> {
  return uploadFile(supabase, bucket, path, file, { ...options, upsert: true });
}

export async function deleteFile(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new StorageError(`Delete of ${bucket}/${path} failed: ${error.message}`, "DELETE_FAILED");
  }
}

/** Downloads a file's raw bytes — for server-side processing (OCR, parsing,
 *  AI ingestion) that needs the actual content rather than a browser-facing
 *  signed URL. */
export async function downloadFile(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    throw new StorageError(`Download of ${bucket}/${path} failed: ${error?.message ?? "unknown error"}`, "DOWNLOAD_FAILED");
  }
  return Buffer.from(await data.arrayBuffer());
}

/** Signed URLs are how private-bucket files get served to the browser —
 *  never expose a service-role key or make buckets public just to display
 *  a file. Default expiry is 1 hour; pass a shorter one for one-time links. */
export async function getSignedUrl(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new StorageError(`Signed URL for ${bucket}/${path} failed: ${error?.message ?? "unknown error"}`, "SIGNED_URL_FAILED");
  }
  return data.signedUrl;
}
