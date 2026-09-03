import "@/lib/polyfills/pdf-node-polyfill";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadPaper } from "@/lib/research/services/ingest.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // OCR + chunking + embeddings on a large PDF can take a while

/** POST /api/research/papers/upload — multipart/form-data with a `file` field (PDF). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A `file` field with a PDF is required." }, { status: 400 });
  }

  try {
    const paper = await uploadPaper({ userId: user.id, file });
    return NextResponse.json({ paper }, { status: 201 });
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    return NextResponse.json({ error: "Failed to upload paper." }, { status: 500 });
  }
}
