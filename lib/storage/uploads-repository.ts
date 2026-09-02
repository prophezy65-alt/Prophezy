import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { uploadFile, deleteFile, getSignedUrl } from "./storage-service";
import { validateFile, UPLOAD_CATEGORIES, type UploadCategory } from "./validation";
import { StorageError } from "./errors";
import type { Database } from "@/lib/supabase/types";

type UploadRow = Database["public"]["Tables"]["uploads"]["Row"];

/**
 * Design note: the real schema has ONE `uploads` table (with a `bucket_id`
 * column) tracking every uploaded file — not seven separate tables for
 * resumes/assignments/research papers/syllabus/projects. So rather than
 * building near-duplicate services per category, this repository handles
 * all of them through the same table, distinguished by a folder prefix
 * (`{userId}/{category}/{uuid}.{ext}`) inside one bucket.
 *
 * I don't know whether separate Storage buckets already exist per category
 * in your Supabase project — this defaults to the single "uploads" bucket
 * that matches `uploads.bucket_id`'s default value. If you've already
 * created e.g. a dedicated "resumes" bucket, pass it via the `bucket`
 * param and it'll be recorded correctly either way.
 */

interface CreateUploadArgs {
  userId: string;
  file: File;
  category: UploadCategory;
  bucket?: string;
}

export async function createUpload({
  userId,
  file,
  category,
  bucket = "uploads",
}: CreateUploadArgs): Promise<UploadRow> {
  validateFile(file, UPLOAD_CATEGORIES[category]);

  const supabase = await createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${userId}/${category}/${randomUUID()}.${ext}`;

  await uploadFile(supabase, bucket, path, file, { contentType: file.type });

  const { data, error } = await supabase
    .from("uploads")
    .insert({
      user_id: userId,
      bucket_id: bucket,
      storage_path: path,
      file_name: file.name,
      file_type: file.type,
      file_size_bytes: file.size,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) {
    // The file made it to storage but the DB row failed — clean up so we
    // don't leave an orphaned file with nothing pointing at it.
    await deleteFile(supabase, bucket, path).catch(() => {
      // Best-effort cleanup; the primary error below is what the caller needs to see.
    });
    throw new StorageError(`Failed to record upload: ${error?.message ?? "unknown error"}`, "DB_INSERT_FAILED");
  }

  return data;
}

/** Replaces the underlying file for an existing upload row in place —
 *  same row id, new content. Useful for e.g. re-processing a corrected PDF. */
export async function replaceUpload(uploadId: string, file: File, category: UploadCategory): Promise<UploadRow> {
  validateFile(file, UPLOAD_CATEGORIES[category]);

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .single();

  if (fetchError || !existing) {
    throw new StorageError("Upload not found.", "NOT_FOUND");
  }

  await uploadFile(supabase, existing.bucket_id, existing.storage_path, file, {
    contentType: file.type,
    upsert: true,
  });

  const { data, error } = await supabase
    .from("uploads")
    .update({
      file_name: file.name,
      file_type: file.type,
      file_size_bytes: file.size,
      status: "pending",
      error_message: null,
    })
    .eq("id", uploadId)
    .select()
    .single();

  if (error || !data) {
    throw new StorageError(`Failed to update upload record: ${error?.message ?? "unknown error"}`, "DB_UPDATE_FAILED");
  }

  return data;
}

export async function deleteUpload(uploadId: string): Promise<void> {
  const supabase = await createClient();
  const { data: upload, error: fetchError } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", uploadId)
    .single();

  if (fetchError || !upload) {
    throw new StorageError("Upload not found.", "NOT_FOUND");
  }

  await deleteFile(supabase, upload.bucket_id, upload.storage_path);

  const { error } = await supabase.from("uploads").delete().eq("id", uploadId);
  if (error) {
    throw new StorageError(`Failed to delete upload record: ${error.message}`, "DB_DELETE_FAILED");
  }
}

export async function getUploadSignedUrl(uploadId: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = await createClient();
  const { data: upload, error } = await supabase.from("uploads").select("*").eq("id", uploadId).single();

  if (error || !upload) {
    throw new StorageError("Upload not found.", "NOT_FOUND");
  }

  return getSignedUrl(supabase, upload.bucket_id, upload.storage_path, expiresInSeconds);
}
