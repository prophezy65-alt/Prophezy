import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { createUpload } from "@/lib/storage/uploads-repository";
import { downloadFile } from "@/lib/storage/storage-service";
import { StorageError } from "@/lib/storage/errors";
import { saveDocument, saveSolution } from "@/lib/assignment-db/repository";
import { processAssignmentBatch } from "@/lib/assignment/services/assignment.service";
import { generateSolutionsForDocument } from "@/lib/assignment/services/generator.service";
import { resolveFileCategory, UnsupportedFileTypeError } from "@/lib/assignment/parser/file-router";
import { FileSignatureMismatchError } from "@/lib/assignment/validation/security";
import type { AssignmentUploadBatch, UploadedAssignmentFile } from "@/lib/assignment/models/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Solving every question up front (not just on-demand) means a single
// upload can now run many sequential Gemini calls — give it real headroom
// instead of hitting a platform default timeout partway through.
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const subject = typeof formData.get("subject") === "string" ? (formData.get("subject") as string) : "";

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > 10) {
    return NextResponse.json({ error: "A single upload cannot exceed 10 files" }, { status: 400 });
  }

  const batchId = randomUUID();
  const batchFiles: UploadedAssignmentFile[] = [];
  const uploadIdByFileId = new Map<string, string>();

  try {
    for (const file of files) {
      const uploadRow = await createUpload({ userId: user.id, file, category: "assignment" });
      const category = resolveFileCategory(file.name, file.type);
      batchFiles.push({
        id: uploadRow.id,
        originalName: file.name,
        mimeType: file.type,
        category,
        sizeBytes: file.size,
        storagePath: uploadRow.storage_path,
        uploadedAt: uploadRow.created_at,
      });
      uploadIdByFileId.set(uploadRow.id, uploadRow.id);
    }
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err instanceof UnsupportedFileTypeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to store uploaded file(s)" }, { status: 500 });
  }

  const batch: AssignmentUploadBatch = {
    batchId,
    userId: user.id,
    createdAt: new Date().toISOString(),
    files: batchFiles,
  };

  const supabase = await createClient();

  try {
    const documents = await processAssignmentBatch(batch, {
      userId: user.id,
      fetchFileBuffer: async (storagePath: string) => {
        // Zip-expanded virtual entries carry a synthetic `${realPath}#entry`
        // path — only the real, uploaded object needs a storage round trip.
        const realPath = storagePath.split("#")[0] ?? storagePath;
        return downloadFile(supabase, "uploads", realPath);
      },
    });

    const saved = [];
    for (const document of documents) {
      const uploadId = uploadIdByFileId.get(document.fileId) ?? null;
      const summary = await saveDocument({ userId: user.id, uploadId, batchId, document, subject });

      // Solve every detected question immediately (not on-demand) —
      // generateSolutionsForDocument bounds concurrency so this doesn't
      // blow past the Core Engine's per-user rate limit, and isolates
      // per-question failures so one bad Gemini call can't sink the whole
      // upload — everything else that succeeded still gets saved.
      const { solutions, failed } =
        document.questions.length > 0
          ? await generateSolutionsForDocument(document.questions, { userId: user.id, mode: "short" }, 3)
          : { solutions: [], failed: [] };

      await Promise.all(
        solutions.map((solution) => saveSolution(solution.questionId, "standard", solution))
      );

      saved.push({ ...summary, questions: document.questions, solutions, unsolvedQuestionIds: failed.map((f) => f.questionId) });
    }

    return NextResponse.json({ documents: saved }, { status: 200 });
  } catch (err) {
    if (err instanceof FileSignatureMismatchError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to process upload batch", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
