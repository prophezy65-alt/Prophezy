/**
 * app/api/hackathons/health/route.ts
 *
 * New route — didn't exist before. Health check across every registered
 * provider (implemented + stub), admin-gated same as /sync.
 */

import { NextResponse } from "next/server";
import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { runHackathonHealthCheck } from "@/lib/hackathons/engine/jobs/sync.job";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { fail } from "@/lib/hackathons/http/response";
import { UnauthorizedError } from "@/lib/hackathons/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET /api/hackathons/health */
export async function GET() {
  try {
    const user = await requireApiUser();
    const supabase = await getSupabaseServerClient();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      throw new UnauthorizedError("Only admins can view provider health.");
    }

    const health = await runHackathonHealthCheck();
    return NextResponse.json({ providers: health, checkedAt: new Date().toISOString() });
  } catch (error) {
    return fail(error);
  }
}
