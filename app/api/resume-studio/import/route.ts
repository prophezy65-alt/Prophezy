// Must be the first import: pdf-parse pulls in pdfjs-dist internally for
// text-layer extraction, and pdfjs-dist expects DOMMatrix/ImageData/Path2D
// to exist as browser globals. In the Vercel Node.js serverless runtime
// they don't, which crashed every PDF import with "DOMMatrix is not
// defined" (reported by a customer via the Resume Studio "Import
// PDF/DOCX" button). Same fix already applied to the research-papers and
// exam-predictor routes for the same underlying pdfjs-dist behavior — see
// lib/polyfills/pdf-node-polyfill.ts for what it does and why.
import "@/lib/polyfills/pdf-node-polyfill";

import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { parseResumeFile } from "@/lib/resume-studio/services/parser.service";
import { toResponse, unauthorized, badRequest } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/resume-studio/import — multipart/form-data with a `file` field.
 *  Returns the parsed { content, rawText, warnings, sourceType } without
 *  saving anything — the client decides whether to use it to prefill a new
 *  resume (POST /api/resume-studio) or merge it into an existing draft. */
export async function POST(request: NextRequest) {
  const authStart = Date.now();
  const user = await getCurrentUser();
  console.log(`[resume-studio IMPORT] auth check took ${Date.now() - authStart}ms`);
  if (!user) return unauthorized();

  const formData = await request.formData().catch(() => null);
  if (!formData) return badRequest("Expected multipart/form-data.");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return badRequest("Missing `file` field.");
  }

  console.log(`[resume-studio IMPORT] user=${user.id} parsing "${file.name}" (${file.type || "unknown type"}, ${file.size} bytes)`);
  const parseStart = Date.now();
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parseResumeFile(buffer, file.name, file.type || undefined);
  console.log(`[resume-studio IMPORT] parse took ${Date.now() - parseStart}ms, ok=${result.ok}${!result.ok ? ` code=${result.error?.code} msg=${result.error?.message}` : ""}`);

  return toResponse(result);
}
