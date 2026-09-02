import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StudySessionsService } from "@/lib/study-hub/services/study-sessions.service";
import { ok, fail } from "@/lib/study-hub/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new StudySessionsService();

/** POST /api/study-hub/sessions/[id]/end — { notes?: string }. Ends the given session. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { notes?: string } | null;
    const session = await service.endSession(user.id, id, body?.notes?.trim() || null);
    return ok(session);
  } catch (error) {
    return fail(error);
  }
}
