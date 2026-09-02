import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listResearchSessions } from "@/lib/research/services/chat.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/research/chat/sessions */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const sessions = await listResearchSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ error: "Failed to list chat sessions." }, { status: 500 });
  }
}
