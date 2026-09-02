import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { getGlobalLeaderboard, getSubjectLeaderboard, getWeeklyLeaderboard } from "@/lib/quiz/services/leaderboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quiz/leaderboard?scope=global|subject|weekly&subject=Physics
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") ?? "global";
    const subject = searchParams.get("subject");

    const entries =
      scope === "subject" && subject
        ? await getSubjectLeaderboard(subject)
        : scope === "weekly"
          ? await getWeeklyLeaderboard()
          : await getGlobalLeaderboard();

    return ok({ scope, subject: scope === "subject" ? subject : null, entries, currentUserId: user.id });
  } catch (error) {
    return fail(error);
  }
}
