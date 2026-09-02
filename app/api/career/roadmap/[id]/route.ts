import { NextResponse } from "next/server";
import { requireCareerUser, ok, fail } from "@/lib/career/http/helpers";
import { buildCareerContext } from "@/lib/career/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    const roadmap = await ctx.repository.getRoadmap(userId, id);
    if (!roadmap) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Roadmap not found." } }, { status: 404 });
    }
    return ok({ roadmap });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, userId } = await requireCareerUser();
    const ctx = buildCareerContext(supabase, userId);

    await ctx.repository.deleteRoadmap(userId, id);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
