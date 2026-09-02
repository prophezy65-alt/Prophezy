import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { requireUuid } from '@/lib/internships/utils/validation';
import { unlockInternshipApplication } from '@/lib/internships/services/application-unlock.service';
import { InsufficientCreditsError } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/internships/:id/unlock
 *
 * Phase 5 — the ONLY endpoint that returns a real applyUrl. Previously
 * this route did not exist at all: unlockInternshipApplication() in
 * lib/internships/services/application-unlock.service.ts was fully built
 * (plan resolution, unlock-cap check, credit spend, refund-on-failure) but
 * nothing in app/api ever called it, and GET /api/internships/:id was
 * leaking the real applyUrl on every plain detail fetch regardless. Both
 * are fixed together: GET now strips applyUrl (see [id]/route.ts) and
 * this is the one gated path that returns it.
 *
 * Requires auth — never optionalUser(). Server-side only; the frontend
 * has no way to grant itself an unlock or bypass the plan/credit checks
 * inside unlockInternshipApplication().
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const internshipId = requireUuid(id, 'id');

    const result = await unlockInternshipApplication(user.id, internshipId);
    return ok(result);
  } catch (error) {
    // InsufficientCreditsError isn't an EngineError (it's shared across
    // every credit-gated feature, not internship-specific), so fail()
    // would otherwise flatten it to a generic 500. Map it to the same
    // 402-style shape every other credit-gated route uses.
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(error.toJSON(), { status: 402 });
    }
    return fail(error);
  }
}
