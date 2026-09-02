import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { StudySessionsService } from "@/lib/study-hub/services/study-sessions.service";
import { ok, fail } from "@/lib/study-hub/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new StudySessionsService();

/** GET /api/study-hub/analytics — real streak/study-time analytics. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

    const analytics = await service.getAnalytics(user.id);
    return ok(analytics);
  } catch (error) {
    return fail(error);
  }
}
