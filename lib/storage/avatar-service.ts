import "server-only";
import { createClient } from "@/lib/supabase/server";
import { replaceFile, deleteFile } from "./storage-service";
import { validateFile, AVATAR_RULES } from "./validation";
import { StorageError } from "./errors";

/**
 * Avatars are handled separately from the uploads repository on purpose:
 * profiles.avatar_url is a plain text column with no FK to the `uploads`
 * table, so avatar files were never meant to go through that pipeline —
 * they're just a URL on the profile, updated directly here.
 *
 * Assumes an "avatars" bucket exists (ideally public-read, since avatar
 * images are typically shown without needing a signed URL). If that
 * bucket doesn't exist yet, this will fail at upload time with a clear
 * Supabase "bucket not found" error rather than something cryptic.
 */
const AVATAR_BUCKET = "avatars";

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  validateFile(file, AVATAR_RULES);

  const supabase = await createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const path = `${userId}/avatar.${ext}`;

  await replaceFile(supabase, AVATAR_BUCKET, path, file, { contentType: file.type });

  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`; // cache-bust on replace

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) {
    throw new StorageError(`Failed to update profile with new avatar: ${error.message}`, "DB_UPDATE_FAILED");
  }

  return avatarUrl;
}

export async function removeAvatar(userId: string, currentPath: string): Promise<void> {
  const supabase = await createClient();
  await deleteFile(supabase, AVATAR_BUCKET, currentPath).catch(() => {
    // If the file's already gone, don't block clearing the profile field.
  });

  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) {
    throw new StorageError(`Failed to clear avatar on profile: ${error.message}`, "DB_UPDATE_FAILED");
  }
}
