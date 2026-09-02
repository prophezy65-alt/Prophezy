import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getResumeService } from "@/lib/resume-studio/repository/get-resume-service";
import { exportFormatSchema, validate } from "@/lib/resume-studio/validation/resume.validation";
import { exportResume } from "@/lib/resume-studio/utils/resume-export";
import { generateResumePdf } from "@/lib/resume-studio/services/pdf-generator.service";
import { generateResumeDocx } from "@/lib/resume-studio/services/docx-generator.service";
import { unauthorized, badRequest, serverError, toResponse } from "@/lib/resume-studio/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  json: "application/json",
  markdown: "text/markdown",
  html: "text/html",
};

const EXTENSIONS: Record<string, string> = {
  pdf: "pdf",
  docx: "docx",
  json: "json",
  markdown: "md",
  html: "html",
};

/** POST /api/resume-studio/:id/export — body: { format }. Returns the file
 *  as a binary/text download rather than a JSON envelope. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const formatValidation = validate(
    exportFormatSchema,
    body && typeof body === "object" ? (body as Record<string, unknown>).format : undefined
  );
  if (!formatValidation.success) {
    return badRequest("Body must include a valid `format`.", formatValidation.errors);
  }
  const format = formatValidation.data;

  const service = await getResumeService();
  const resumeResult = await service.getResume(id);
  if (!resumeResult.ok || !resumeResult.data) return toResponse(resumeResult);
  if (resumeResult.data.userId !== user.id) {
    return toResponse({ ok: false, error: { code: "FORBIDDEN", message: "You do not have access to this resume." } });
  }
  const resume = resumeResult.data;
  const fileNameBase = resume.title.replace(/[^a-z0-9\-_]+/gi, "_").slice(0, 80) || "resume";

  try {
    if (format === "pdf") {
      const bytes = await generateResumePdf(resume);
      return new NextResponse(new Blob([new Uint8Array(bytes)]), {
        status: 200,
        headers: {
          "Content-Type": CONTENT_TYPES.pdf!,
          "Content-Disposition": `attachment; filename="${fileNameBase}.pdf"`,
        },
      });
    }

    if (format === "docx") {
      const buffer = await generateResumeDocx(resume);
      return new NextResponse(new Blob([new Uint8Array(buffer)]), {
        status: 200,
        headers: {
          "Content-Type": CONTENT_TYPES.docx!,
          "Content-Disposition": `attachment; filename="${fileNameBase}.docx"`,
        },
      });
    }

    // json / markdown / html — plain text exporters.
    const { content } = exportResume(resume, format);
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": `${CONTENT_TYPES[format]!}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${fileNameBase}.${EXTENSIONS[format]}"`,
      },
    });
  } catch {
    return serverError("Failed to export resume.");
  }
}
