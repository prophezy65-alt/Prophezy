import type { NextRequest } from 'next/server';
import { InternshipRepository } from '@/lib/internships/db/repositories';
import { MatcherService, RecommendationService, TrackingService } from '@/lib/internships/services';
import { UserRepository } from '@/lib/internships/db/repositories';
import { optionalUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { requireUuid } from '@/lib/internships/utils/validation';
import { toPublicInternship, toPublicInternships } from '@/lib/internships/db/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const internships = new InternshipRepository();
const users = new UserRepository();
const matcher = new MatcherService();
const recommendations = new RecommendationService();
const tracking = new TrackingService();

/** GET /api/internships/:id — full detail, plus the caller's match when signed in.
 * Phase 5: applyUrl is stripped from the response — the real application
 * link only ever comes from POST /api/internships/:id/unlock, which is
 * gated on plan + credits + the per-period unlock allowance. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const internshipId = requireUuid(id, 'id');

    const [internship, user] = await Promise.all([
      internships.findById(internshipId),
      optionalUser(),
    ]);

    void tracking.recordView(user?.id ?? null, internshipId);

    const [match, similar] = await Promise.all([
      user
        ? users.getProfile(user.id).then((profile) => matcher.match(internship, profile)).catch(() => null)
        : Promise.resolve(null),
      recommendations.similarTo(internshipId, 6).catch(() => []),
    ]);

    return ok({ internship: toPublicInternship(internship), match, similar: toPublicInternships(similar) });
  } catch (error) {
    return fail(error);
  }
}
