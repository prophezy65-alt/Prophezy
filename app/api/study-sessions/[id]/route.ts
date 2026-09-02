import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { StudySessionsService } from "@/lib/study-hub/services/study-sessions.service";
import { StudyHubError } from "@/lib/study-hub/errors";
import { ok, fail } from "@/lib/study-hub/http/response";

const service = new StudySessionsService();

// PATCH /api/study-sessions/:id  { notes? }  — end a session
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new StudyHubError("Sign in required.", "UNAUTHENTICATED", 401);

    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    const notesRaw = typeof body === "object" && body !== null ? (body as { notes?: unknown }).notes : undefined;
    const notes = typeof notesRaw === "string" && notesRaw.trim().length > 0 ? notesRaw.trim() : null;

    return ok(await service.endSession(user.id, id, notes));
  } catch (error) {
    return fail(error);
  }
}
