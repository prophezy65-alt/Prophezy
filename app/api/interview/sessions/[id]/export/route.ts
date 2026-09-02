import type { NextRequest } from "next/server";
import { requireAuth, fail, HttpError } from "@/lib/interview/http";
import { exportRequestSchema } from "@/lib/validations/interview";
import { loadSessionReportBundle } from "@/lib/interview/export/report-loader";
import {
  buildMarkdownReport,
  buildJsonReport,
  buildPdfReport,
  buildDocxReport,
} from "@/lib/interview/export/export.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  markdown: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
} as const;

const EXTENSIONS = { pdf: "pdf", docx: "docx", markdown: "md", json: "json" } as const;

/**
 * GET /api/interview/sessions/:id/export?format=pdf|docx|markdown|json
 * Streams a downloadable report built from the session's evaluated answers.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await context.params;
    const { format } = exportRequestSchema.parse({
      sessionId: id,
      format: new URL(request.url).searchParams.get("format") ?? "markdown",
    });

    const bundle = await loadSessionReportBundle(supabase, user.id, id);
    if (bundle.items.length === 0) {
      throw new HttpError(400, "Nothing to export yet — answer at least one question first.");
    }

    const filename = `interview-report-${id}.${EXTENSIONS[format]}`;
    const headers = new Headers({
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    });

    if (format === "markdown") return new Response(buildMarkdownReport(bundle), { headers });
    if (format === "json") return new Response(buildJsonReport(bundle), { headers });

    const buffer = format === "pdf" ? await buildPdfReport(bundle) : await buildDocxReport(bundle);
    return new Response(new Uint8Array(buffer), { headers });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("loadSessionReportBundle")) {
      return fail(new HttpError(404, "Session not found."));
    }
    return fail(error);
  }
}
