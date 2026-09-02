import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContentViewsService } from "@/lib/study-hub/services/content-views.service";
import { isStudyEntityType } from "@/lib/study-hub/types";
import { ok, fail } from "@/lib/study-hub/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const service = new ContentViewsService();

/** POST /api/study-hub/content-views — { entityType, entityId }. Records a real view. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { entityType?: string; entityId?: string } | null;
    if (!body?.entityType || !isStudyEntityType(body.entityType) || !body.entityId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "entityType (valid StudyEntityType) and entityId are required." } },
        { status: 400 }
      );
    }

    await service.record(user.id, body.entityType, body.entityId);
    return ok({ recorded: true }, 201);
  } catch (error) {
    return fail(error);
  }
}

/** GET /api/study-hub/content-views — recent real content views, newest first. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } }, { status: 401 });

    const views = await service.listRecent(user.id, undefined, 5);
    return ok(views);
  } catch (error) {
    return fail(error);
  }
}
