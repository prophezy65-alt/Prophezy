import type { NextRequest } from 'next/server';
import { NotificationService } from '@/lib/internships/services';
import { requireUser } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';
import { isUuid } from '@/lib/internships/utils/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notifications = new NotificationService();

/** GET /api/internships/notifications?unread=true */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 100);
    return ok(await notifications.list(user.id, unreadOnly, limit));
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/internships/notifications  { ids?: string[] } — marks read (all when omitted). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string' && isUuid(id)) : [];
    await notifications.markRead(user.id, ids);
    return ok({ marked: ids.length > 0 ? ids.length : 'all' });
  } catch (error) {
    return fail(error);
  }
}
