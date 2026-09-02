import type { NextRequest } from 'next/server';
import { RecommendationService } from '@/lib/internships/services';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { toPublicInternship } from '@/lib/internships/db/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const recommendations = new RecommendationService();

/** GET /api/internships/recommendations?limit=20&force=true */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 50);
    const force = url.searchParams.get('force') === 'true';

    const bundles = await recommendations.forUser(user.id, limit, { force });
    // Phase 5: strip applyUrl from the embedded internship — recommendations
    // are still just browsing, not an unlock.
    return ok(bundles.map((bundle) => ({ ...bundle, internship: toPublicInternship(bundle.internship) })));
  } catch (error) {
    return fail(error);
  }
}

