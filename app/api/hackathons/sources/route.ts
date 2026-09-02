/**
 * app/api/hackathons/sources/route.ts
 *
 * New route — the registry itself as an API: which sources are real vs
 * stubbed, and why. Not admin-gated (informational only, no data
 * mutation) — useful for a "Data sources" section in the UI so users know
 * that "hackathons worldwide" today really means "Devpost + GitHub
 * hackathon-topic repos," not fabricated global coverage.
 */

import { NextResponse } from "next/server";
import { listRegisteredSources } from "@/lib/hackathons/engine/jobs/sync.job";
import { requireApiUser } from "@/lib/hackathons/http/auth";
import { fail } from "@/lib/hackathons/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/hackathons/sources */
export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json({ sources: listRegisteredSources() });
  } catch (error) {
    return fail(error);
  }
}
