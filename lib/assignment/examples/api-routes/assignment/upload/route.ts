// EXAMPLE: app/api/assignment/upload/route.ts
// Copy into your actual app/api/assignment/upload/route.ts. Adjust the
// getCurrentUserId() and fetchFileBuffer() calls to your existing
// auth/storage helpers (both intentionally out of scope for this module).

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { processAssignmentBatch } from "@/lib/assignment/services/assignment.service";
import { validateUploadBatchRequest } from "@/lib/assignment/validation/schemas";
import type { AssignmentUploadBatch } from "@/lib/assignment/models/types";
import { resolveFileCategory } from "@/lib/assignment/parser/file-router";

// Replace with your existing auth helper, e.g.:
// import { getCurrentUserId } from "@/lib/auth/session";
declare function getCurrentUserId(req: NextRequest): Promise<string>;

// Replace with your existing Supabase Storage download helper, e.g.:
// import { downloadFromStorage } from "@/lib/supabase/storage";
declare function downloadFromStorage(storagePath: string): Promise<Buffer>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = validateUploadBatchRequest(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const { files } = body as { files: { originalName: string; mimeType: string; sizeBytes: number; storagePath: string }[] };

  const batch: AssignmentUploadBatch = {
    batchId: randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    files: files.map((f) => ({
      id: randomUUID(),
      originalName: f.originalName,
      mimeType: f.mimeType,
      category: resolveFileCategory(f.originalName, f.mimeType),
      sizeBytes: f.sizeBytes,
      storagePath: f.storagePath,
      uploadedAt: new Date().toISOString(),
    })),
  };

  try {
    const documents = await processAssignmentBatch(batch, {
      userId,
      fetchFileBuffer: downloadFromStorage,
    });
    return NextResponse.json({ documents }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to process upload batch", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
