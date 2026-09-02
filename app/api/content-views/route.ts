import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ContentViewsService } from "@/lib/study-hub/services/content-views.service";
import { StudyHubError } from "@/lib/study-hub/errors";
import { isStudyEntityType, type StudyEntityType } from "@/lib/study-hub/types";
import { ok, fail } from "@/lib/study-hub/http/response";

const service = new ContentViewsService();

// GET /api/content-views?entityType=note&limit=20
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new StudyHubError("Sign in required.", "UNAUTHENTICATED", 401);

    const entityTypeParam = request.nextUrl.searchParams.get("entityType");
    let entityType: StudyEntityType | undefined;
    if (entityTypeParam !== null) {
      if (!isStudyEntityType(entityTypeParam)) {
        throw new StudyHubError(`Invalid entityType: ${entityTypeParam}`, "INVALID_ENTITY_TYPE", 400);
      }
      entityType = entityTypeParam;
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam ?? 20) || 20, 1), 100);

    return ok(await service.listRecent(user.id, entityType, limit));
  } catch (error) {
    return fail(error);
  }
}

// POST /api/content-views  { entityType, entityId }
// Called by each content type's own detail page on load — same pattern as
// the internship module's recordView(), just generalized across entity types.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new StudyHubError("Sign in required.", "UNAUTHENTICATED", 401);

    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      throw new StudyHubError("Invalid request body.", "INVALID_BODY", 400);
    }
    const { entityType, entityId } = body as { entityType?: unknown; entityId?: unknown };

    if (typeof entityType !== "string" || !isStudyEntityType(entityType)) {
      throw new StudyHubError(`Invalid entityType: ${String(entityType)}`, "INVALID_ENTITY_TYPE", 400);
    }
    if (typeof entityId !== "string" || entityId.length === 0) {
      throw new StudyHubError("entityId is required.", "INVALID_ENTITY_ID", 400);
    }

    await service.record(user.id, entityType, entityId);
    return ok({ recorded: true }, 201);
  } catch (error) {
    return fail(error);
  }
}
