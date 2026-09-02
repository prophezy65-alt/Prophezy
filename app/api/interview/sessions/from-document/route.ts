import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, ok, fail, HttpError } from "@/lib/interview/http";
import { createSession } from "@/lib/interview/services/session.service";
import { ocrImage } from "@/lib/ai/services/ocr.service";
import { generate, type GeminiMessage } from "@/lib/ai/config/client";
import { resolveModelForFeature } from "@/lib/ai/config/models";
import type { InterviewType, Seniority } from "@/lib/interview/models/interview.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_TEXT_CHARS = 15_000;

const metaSchema = z.object({
  role: z.string().min(2, "Enter the subject or course you're being examined on"),
  interviewType: z.enum(["college-viva", "school-viva"]),
  seniority: z.enum(["intern", "junior", "mid", "senior", "staff+"]),
  questionCount: z.number().int().min(1).max(30),
});

/**
 * POST /api/interview/sessions/from-document  (multipart/form-data)
 *
 * Viva-only entry point: the student uploads their syllabus / notes as a PDF,
 * Word doc, image, or text file. We extract the text server-side and feed it
 * as grounding context so the interviewer asks questions strictly from that
 * material. Falls back to the normal generator with the document as context.
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "Please attach a syllabus or document to continue.");
    }
    if (file.size === 0) throw new HttpError(400, "The uploaded file is empty.");
    if (file.size > MAX_BYTES) throw new HttpError(400, "File is too large (max 15 MB).");

    const meta = metaSchema.parse({
      role: String(form.get("role") ?? ""),
      interviewType: String(form.get("interviewType") ?? ""),
      seniority: String(form.get("seniority") ?? "mid"),
      questionCount: Number(form.get("questionCount") ?? 8),
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = (await extractText(user.id, file.name, file.type, buffer)).slice(0, MAX_TEXT_CHARS).trim();

    if (text.length < 20) {
      throw new HttpError(
        422,
        "Couldn't read enough text from that file. Try a clearer PDF/image or a Word/text file.",
      );
    }

    const result = await createSession(supabase, user.id, {
      role: meta.role.trim(),
      interviewType: meta.interviewType as InterviewType,
      seniority: meta.seniority as Seniority,
      questionCount: meta.questionCount,
      projectContext: text,
    });

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}

async function extractText(
  userId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const isImage = mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext);

  if (ext === "pdf" || mimeType === "application/pdf") {
    return extractPdf(buffer);
  }
  if (ext === "docx" || mimeType.includes("wordprocessingml")) {
    return extractDocx(buffer);
  }
  if (ext === "txt" || ext === "md" || mimeType.startsWith("text/")) {
    return buffer.toString("utf8");
  }
  if (isImage) {
    const result = await ocrImage(userId, buffer);
    return result.cleanedText;
  }
  throw new HttpError(415, "Unsupported file type. Upload a PDF, Word (.docx), image, or text file.");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // Gemini reads PDFs natively via inline data — far more robust inside Next
  // than bundling pdf-parse/pdfjs. Ask it to transcribe the document's text.
  const messages: GeminiMessage[] = [
    {
      role: "user",
      parts: [
        {
          text:
            "Transcribe ALL text from this PDF document exactly, preserving " +
            "structure (headings, bullet points, tables as markdown). Output only " +
            "the transcribed content, no commentary.",
        },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        },
      ],
    },
  ];

  const result = await generate(messages, {
    model: resolveModelForFeature("interview").id,
    temperature: 0.1,
    maxOutputTokens: 8192,
  });
  return result.text ?? "";
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value ?? "";
}
