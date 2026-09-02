import type { NextRequest } from 'next/server';
import { SearchService } from '@/lib/internships/services';
import { optionalUser } from '@/lib/internships/http/auth';
import { parseSearchRequest } from '@/lib/internships/http/parse';
import { fail, ok } from '@/lib/internships/http/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const search = new SearchService();

/**
 * GET /api/internships/search?q=...&mode=hybrid
 * Modes: keyword (Postgres FTS), semantic (pgvector), hybrid (RRF fusion — default).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await optionalUser();
    const url = new URL(request.url);
    const parsed = parseSearchRequest(url, user?.id ?? null);
    const page = await search.search({ ...parsed, mode: parsed.mode ?? 'hybrid' });
    // Unwrap SearchHit -> flat record (see prior comment history for why),
    // but keep the score instead of discarding it — the UI now wants an
    // "AI Match %" on every card. `score` here is already a 0-100-ish
    // ranking score computed by RankingService; clamp defensively in case
    // future scoring changes the scale.
    return ok({
      ...page,
      items: page.items.map((hit) => ({
        ...hit.item,
        matchScore: Math.max(0, Math.min(100, Math.round(hit.score))),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}
