import type { NextRequest } from 'next/server';
import { TrackingService } from '@/lib/internships/services';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { oneOf, requireUuid, str } from '@/lib/internships/utils/validation';
import type { ApplicationStatus } from '@/lib/internships/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tracking = new TrackingService();

const STATUSES: readonly ApplicationStatus[] = [
  'saved', 'applied', 'interview_scheduled', 'rejected', 'offer', 'accepted', 'withdrawn',
];

/** GET /api/internships/applications?status=applied */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const status = oneOf(STATUSES)(new URL(request.url).searchParams.get('status'), 'status');
    const [items, funnel] = await Promise.all([
      tracking.listApplications(user.id, status ?? undefined),
      tracking.funnel(user.id),
    ]);
    return ok({ items, funnel });
  } catch (error) {
    return fail(error);
  }
}

/** PATCH /api/internships/applications  { internshipId, status, notes?, interviewAt?, documents? } */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as Record<string, unknown>;

    const internshipId = requireUuid(body.internshipId, 'internshipId');
    const status = oneOf(STATUSES, false)(body.status, 'status') as ApplicationStatus;

    const result = await tracking.transition(user.id, internshipId, status, {
      notes: body.notes ? str({ max: 5_000 })(body.notes, 'notes') : undefined,
      interviewAt: body.interviewAt ? str({ max: 40 })(body.interviewAt, 'interviewAt') : undefined,
      deadlineAt: body.deadlineAt ? str({ max: 40 })(body.deadlineAt, 'deadlineAt') : undefined,
      documents: Array.isArray(body.documents)
        ? (body.documents as never[]).slice(0, 10)
        : undefined,
    });
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
