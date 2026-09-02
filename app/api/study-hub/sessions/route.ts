import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StudySessionsService } from "@/lib/study-hub/services/study-sessions.service";
import { ok, fail } from "@/lib/study-hub/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new StudySessionsService();

/** POST /api/study-hub/sessions — { subject?: string }. Starts a session. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { subject?: string } | null;
    const session = await service.startSession(user.id, body?.subject?.trim() || null);
    return ok(session, 201);
  } catch (error) {
    return fail(error);
  }
}

/** GET /api/study-hub/sessions — the currently active session, if any. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

    const active = await service.getActiveSession(user.id);
    return ok(active);
  } catch (error) {
    return fail(error);
  }
}
