import type { NextRequest } from 'next/server';
import { NotificationService } from '@/lib/internships/services';
import { requireSyncSecret } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const notifications = new NotificationService();

/**
 * POST /api/internships/notifications/dispatch
 * Machine-triggered fan-out. Body: { job: "daily" | "weekly" | "alerts" | "deadlines" }
 */
export async function POST(request: NextRequest) {
  try {
    requireSyncSecret(request);
    const body = (await request.json().catch(() => ({}))) as { job?: string };

    switch (body.job) {
      case 'daily':
        return ok(await notifications.sendDigest('daily_digest'));
      case 'weekly':
        return ok(await notifications.sendDigest('weekly_digest'));
      case 'alerts':
        return ok(await notifications.sendNewInternshipAlerts(24));
      case 'deadlines':
        return ok(await notifications.sendDeadlineReminders());
      default:
        return ok({
          error: 'Unknown job',
          accepted: ['daily', 'weekly', 'alerts', 'deadlines'],
        }, { status: 400 });
    }
  } catch (error) {
    return fail(error);
  }
}
