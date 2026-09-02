import type { NextRequest } from 'next/server';
import { TrackingService } from '@/lib/internships/services';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { requireUuid } from '@/lib/internships/utils/validation';
import { toPublicInternships } from '@/lib/internships/db/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tracking = new TrackingService();

/** GET /api/internships/saved — Phase 5: applyUrl stripped, saving/browsing
 * is not an unlock. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(toPublicInternships(await tracking.listSaved(user.id)));
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/internships/saved  { internshipId } */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { internshipId?: unknown };
    const internshipId = requireUuid(body.internshipId, 'internshipId');
    return ok(await tracking.save(user.id, internshipId), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/internships/saved?internshipId=... */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();
    const internshipId = requireUuid(new URL(request.url).searchParams.get('internshipId'), 'internshipId');
    await tracking.unsave(user.id, internshipId);
    return ok({ removed: internshipId });
  } catch (error) {
    return fail(error);
  }
}
