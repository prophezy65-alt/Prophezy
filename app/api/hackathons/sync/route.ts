/**
 * app/api/hackathons/sync/route.ts
 *
 * ⚠️ I don't have your current version of this file (it wasn't in the
 * lib.zip/supabase.zip you sent, and my own earlier session's copy is
 * gone — this sandbox resets between turns). This is a clean rewrite
 * based on the pattern from earlier in this conversation. COMPARE AGAINST
 * YOUR ACTUAL FILE before replacing it, in case anything else has been
 * added since.
 *
 * Change from before: now calls lib/hackathons/engine/jobs/sync.job.ts's
 * runHackathonSync() (circuit breaker, dedup, normalize, retry, rate
 * limiting) instead of ProviderService#syncAllSources() (still present,
 * untouched, just no longer the path this route uses — see the engine's
 * README for why it supersedes rather than replaces that file).
 *
 * Still admin-gated via the EXISTING profiles.role column — same pattern
 * as before, not new auth infrastructure.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { runHackathonSync } from "@/lib/hackathons/engine/jobs/sync.job";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { fail } from "@/lib/hackathons/http/response";
import { UnauthorizedError } from "@/lib/hackathons/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/hackathons/sync?mode=incremental|full — triggers a real
 * aggregation run across every implemented source (Devpost, GitHub Events
 * today). Body (optional): { only?: string[], retentionDays?: number }.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();

    const supabase = await getSupabaseServerClient();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      throw new UnauthorizedError("Only admins can trigger a hackathon sync.");
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") === "full" ? "full" : "incremental";
    const body = await request.json().catch(() => ({}));

    const summary = await runHackathonSync({
      mode,
      only: Array.isArray(body?.only) ? body.only : undefined,
      retentionDays: typeof body?.retentionDays === "number" ? body.retentionDays : undefined,
    });

    return NextResponse.json(summary);
  } catch (error) {
    return fail(error);
  }
}
