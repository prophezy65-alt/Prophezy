// lib/assignment/services/assignment.service.ts
//
// Top-level orchestrator. This is the ONE function API routes should call to
// go from "batch of uploaded files" to "fully analyzed AssignmentDocument[]".
// Internally it fans out to parser.service -> question.service, and
// generator.service is called separately (on-demand, per question) since
// generating full solutions for every question up front would be wasteful —
// students often only want solutions for questions they're stuck on.

import { randomUUID } from "crypto";
import type { AssignmentDocument, AssignmentUploadBatch, UploadedAssignmentFile } from "../models/types";
import { parseUploadedFile } from "./parser.service";
import { detectQuestions } from "./question.service";
import { resolveFileCategory, assertWithinSizeLimit } from "../parser/file-router";
import { logAnalyticsEvent } from "./analytics.service";
import { verifyFileSignature, FileSignatureMismatchError, sanitizeFileNameInput } from "../validation/security";

export interface ProcessBatchOptions {
  userId: string;
  /** File byte fetcher — kept abstract so this service has zero dependency
   * on Supabase Storage's client API (which lives outside this module's
   * scope). The caller (API route) resolves storagePath -> Buffer using the
   * existing upload infrastructure. */
  fetchFileBuffer: (storagePath: string) => Promise<Buffer>;
}

export async function processAssignmentBatch(
  batch: AssignmentUploadBatch,
  options: ProcessBatchOptions
): Promise<AssignmentDocument[]> {
  const documents: AssignmentDocument[] = [];

  for (const file of batch.files) {
    const fileDocuments = await processSingleFile(file, batch, options);
    documents.push(...fileDocuments);
  }

  return documents;
}

async function processSingleFile(
  file: UploadedAssignmentFile,
  batch: AssignmentUploadBatch,
  options: ProcessBatchOptions
): Promise<AssignmentDocument[]> {
  assertWithinSizeLimit(file.sizeBytes, file.originalName);
  const safeName = sanitizeFileNameInput(file.originalName);
  const buffer = await options.fetchFileBuffer(file.storagePath);

  const signatureCheck = verifyFileSignature(buffer, file.category);
  if (!signatureCheck.matchesClaimedCategory) {
    throw new FileSignatureMismatchError(safeName, file.category, signatureCheck.detectedCategory);
  }

  const parseResult = await parseUploadedFile({ ...file, originalName: safeName }, buffer, { userId: options.userId });

  // ZIP archives expand into N sub-documents, each processed as its own file.
  if ("isArchive" in parseResult) {
    const results: AssignmentDocument[] = [];
    for (const entry of parseResult.entries) {
      const category = resolveFileCategory(entry.fileName, "");
      const virtualFile: UploadedAssignmentFile = {
        id: randomUUID(),
        originalName: entry.fileName,
        mimeType: "",
        category,
        sizeBytes: entry.buffer.length,
        storagePath: `${file.storagePath}#${entry.fileName}`,
        uploadedAt: file.uploadedAt,
      };
      const nested = await parseUploadedFile(virtualFile, entry.buffer, { userId: options.userId });
      if ("isArchive" in nested) continue; // nested archives already rejected upstream
      results.push(await buildDocument(virtualFile, batch, nested, options));
    }
    return results;
  }

  return [await buildDocument(file, batch, parseResult, options)];
}

async function buildDocument(
  file: UploadedAssignmentFile,
  batch: AssignmentUploadBatch,
  extraction: Awaited<ReturnType<typeof parseUploadedFile>> extends infer R
    ? R extends { isArchive: true }
      ? never
      : R
    : never,
  options: ProcessBatchOptions
): Promise<AssignmentDocument> {
  await logAnalyticsEvent({
    userId: options.userId,
    documentId: file.id,
    eventType: "ocr_complete",
    metadata: { fileName: file.originalName, warnings: extraction.extractionWarnings.length },
    timestamp: new Date().toISOString(),
  });

  const { questions, detectedSubjectArea } = await detectQuestions(extraction, {
    userId: options.userId,
    fileId: file.id,
  });

  await logAnalyticsEvent({
    userId: options.userId,
    documentId: file.id,
    eventType: "question_detected",
    metadata: { questionCount: questions.length },
    timestamp: new Date().toISOString(),
  });

  return {
    id: randomUUID(),
    batchId: batch.batchId,
    fileId: file.id,
    title: file.originalName,
    extraction,
    questions,
    detectedSubjectArea,
    createdAt: new Date().toISOString(),
  };
}
