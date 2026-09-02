import type { NextRequest } from 'next/server';
import { SyncService } from '@/lib/internships/services';
import { requireSyncSecret } from '@/lib/internships/http/auth';
import { fail, ok } from '@/lib/internships/http/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const sync = new SyncService();

/**
 * POST /api/internships/sync
 * Machine-triggered. Requires `Authorization: Bearer $INTERNSHIP_SYNC_SECRET`.
 * Body: { full?: boolean, providers?: string[], maxItemsPerProvider?: number }
 */
export async function POST(request: NextRequest) {
  try {
    requireSyncSecret(request);
    const body = (await request.json().catch(() => ({}))) as {
      full?: boolean;
      providers?: string[];
      maxItemsPerProvider?: number;
    };

    const summary = await sync.runAll({
      full: body.full === true,
      providers: Array.isArray(body.providers) ? body.providers.slice(0, 60) : undefined,
      maxItemsPerProvider: Math.min(Number(body.maxItemsPerProvider ?? 1_000) || 1_000, 5_000),
    });
    return ok(summary);
  } catch (error) {
    return fail(error);
  }
}

/** GET /api/internships/sync — recent runs and live provider health. */
export async function GET(request: NextRequest) {
  try {
    requireSyncSecret(request);
    const [runs, health] = await Promise.all([sync.recentRuns(50), sync.checkAllHealth()]);
    return ok({ runs, health });
  } catch (error) {
    return fail(error);
  }
}
