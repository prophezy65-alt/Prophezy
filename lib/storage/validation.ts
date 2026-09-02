import { StorageError } from "./errors";

/**
 * Per-category upload rules. These are reasonable defaults, not confirmed
 * against your actual product requirements — adjust freely. What matters
 * architecturally is that every upload path goes through validateFile()
 * before touching storage, so limits live in exactly one place.
 */
export const UPLOAD_CATEGORIES = {
  resume: { maxSizeBytes: 5 * 1024 * 1024, allowedTypes: ["application/pdf"] },
  assignment: {
    maxSizeBytes: 20 * 1024 * 1024,
    allowedTypes: ["application/pdf", "image/png", "image/jpeg"],
  },
  research_paper: { maxSizeBytes: 25 * 1024 * 1024, allowedTypes: ["application/pdf"] },
  syllabus: { maxSizeBytes: 15 * 1024 * 1024, allowedTypes: ["application/pdf"] },
  project: {
    maxSizeBytes: 20 * 1024 * 1024,
    allowedTypes: ["application/pdf", "application/zip", "image/png", "image/jpeg"],
  },
  general: {
    maxSizeBytes: 20 * 1024 * 1024,
    allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  },
  notes: {
    maxSizeBytes: 20 * 1024 * 1024,
    allowedTypes: [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
} as const;

export type UploadCategory = keyof typeof UPLOAD_CATEGORIES;

export const AVATAR_RULES = {
  maxSizeBytes: 2 * 1024 * 1024,
  allowedTypes: ["image/png", "image/jpeg", "image/webp"],
} as const;

export function validateFile(
  file: File,
  rules: { maxSizeBytes: number; allowedTypes: readonly string[] },
): void {
  if (file.size > rules.maxSizeBytes) {
    throw new StorageError(
      `File exceeds the ${(rules.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB limit for this upload type.`,
      "FILE_TOO_LARGE",
    );
  }
  if (!rules.allowedTypes.includes(file.type)) {
    throw new StorageError(
      `File type "${file.type}" isn't allowed here. Accepted: ${rules.allowedTypes.join(", ")}.`,
      "INVALID_FILE_TYPE",
    );
  }
}
