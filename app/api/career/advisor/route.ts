import { NextResponse, type NextRequest } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/career/advisor?sessionId=... — message history, or the session list if sessionId is omitted. */
export async function GET(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);
    const sessionId = new URL(request.url).searchParams.get("sessionId");

    if (sessionId) {
      const messages = await ctx.repository.getAdvisorMessages(userId, sessionId);
      return ok({ sessionId, messages });
    }

    const sessions = await ctx.repository.listAdvisorSessions(userId);
    return ok({ sessions });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/career/advisor?sessionId=... — removes a saved conversation. */
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);
    const sessionId = new URL(request.url).searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "sessionId is required." } },
        { status: 400 }
      );
    }

    await ctx.repository.deleteAdvisorSession(userId, sessionId);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/career/advisor — { sessionId?: string, question: string }. */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const body = (await request.json().catch(() => null)) as { sessionId?: string; question?: string } | null;
    const question = body?.question?.trim();
    if (!question) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "A question is required." } },
        { status: 400 }
      );
    }

    const sessionId = body?.sessionId ?? (await ctx.repository.createAdvisorSession(userId, question.slice(0, 80)));
    await ctx.repository.appendAdvisorMessage(sessionId, "user", question);

    const profileResult = await ctx.careerService.buildProfile(userId);
    if (!profileResult.ok || !profileResult.data) {
      return fail(new Error(profileResult.error?.message ?? "Failed to build career profile."));
    }

    const answer = await ctx.careerService.askAdvisor(profileResult.data, question);
    if (!answer.ok || answer.data === undefined) {
      return NextResponse.json(
        { ok: false, error: { code: answer.error?.code ?? "ADVISOR_FAILED", message: answer.error?.message ?? "The advisor could not respond right now." } },
        { status: 502 }
      );
    }

    await ctx.repository.appendAdvisorMessage(sessionId, "assistant", answer.data);

    return ok({ sessionId, answer: answer.data });
  } catch (error) {
    return fail(error);
  }
}
