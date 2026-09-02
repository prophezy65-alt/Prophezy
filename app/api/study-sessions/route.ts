import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { StudySessionsService } from "@/lib/study-hub/services/study-sessions.service";
import { StudyHubError } from "@/lib/study-hub/errors";
import { ok, fail } from "@/lib/study-hub/http/response";

const service = new StudySessionsService();

// GET /api/study-sessions — analytics + the currently active session (if any)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new StudyHubError("Sign in required.", "UNAUTHENTICATED", 401);

    const [analytics, activeSession] = await Promise.all([
      service.getAnalytics(user.id),
      service.getActiveSession(user.id),
    ]);

    return ok({ analytics, activeSession });
  } catch (error) {
    return fail(error);
  }
}

// POST /api/study-sessions  { subject? }  — start a session
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new StudyHubError("Sign in required.", "UNAUTHENTICATED", 401);

    const existing = await service.getActiveSession(user.id);
    if (existing) {
      throw new StudyHubError("A study session is already active.", "SESSION_ALREADY_ACTIVE", 409);
    }

    const body: unknown = await request.json().catch(() => ({}));
    const subjectRaw = typeof body === "object" && body !== null ? (body as { subject?: unknown }).subject : undefined;
    const subject = typeof subjectRaw === "string" && subjectRaw.trim().length > 0 ? subjectRaw.trim() : null;

    return ok(await service.startSession(user.id, subject), 201);
  } catch (error) {
    return fail(error);
  }
}
