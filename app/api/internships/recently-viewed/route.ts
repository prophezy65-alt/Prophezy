import type { NextRequest } from 'next/server';
import { TrackingService } from '@/lib/internships/services';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { toPublicInternships } from '@/lib/internships/db/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tracking = new TrackingService();

/** GET /api/internships/recently-viewed?limit=30 — Phase 5: applyUrl
 * stripped; viewing is not an unlock. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const limitParam = new URL(request.url).searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam ?? 30) || 30, 1), 100);
    return ok(toPublicInternships(await tracking.listRecentlyViewed(user.id, limit)));
  } catch (error) {
    return fail(error);
  }
}
