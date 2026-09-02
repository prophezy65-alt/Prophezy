import type { NextRequest } from 'next/server';
import { SearchService } from '@/lib/internships/services';
import { optionalUser } from '@/lib/internships/http/auth';
import { parseSearchRequest } from '@/lib/internships/http/parse';
import { fail, ok } from '@/lib/internships/http/response';
import { toPublicInternship } from '@/lib/internships/db/mappers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const search = new SearchService();

/**
 * GET /api/internships/search?q=...&mode=hybrid
 * Modes: keyword (Postgres FTS), semantic (pgvector), hybrid (RRF fusion).
 *
 * Mode is intentionally left as `parsed.mode` (usually undefined — the
 * client never sends it) rather than defaulted here. SearchService.search()
 * is the single place that resolves the actual mode, because it also has to
 * know the requested `sort`: an explicit database-ordered sort ("Newest",
 * "Deadline soon", stipend) must resolve to 'keyword' regardless of query
 * text, while a text query with no explicit sort should get 'hybrid'.
 * Hardcoding `?? 'hybrid'` here would silently re-introduce that bug — a
 * route-level default can't see `sort` and would always win over it.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await optionalUser();
    const url = new URL(request.url);
    const parsed = parseSearchRequest(url, user?.id ?? null);
    const page = await search.search(parsed);
    // Unwrap SearchHit -> flat record (see prior comment history for why),
    // but keep the score instead of discarding it — the UI now wants an
    // "AI Match %" on every card. `score` here is already a 0-100-ish
    // ranking score computed by RankingService; clamp defensively in case
    // future scoring changes the scale.
    // Phase 5: strip applyUrl — browsing must never leak the real
    // application link; only POST /api/internships/[id]/unlock does.
    const response = ok({
      ...page,
      items: page.items.map((hit) => ({
        ...toPublicInternship(hit.item),
        matchScore: Math.max(0, Math.min(100, Math.round(hit.score))),
      })),
    });
    // ok() only sets Cache-Control when a cacheSeconds option is passed —
    // otherwise it sends NO caching header at all. An absent header is not
    // "don't cache": browsers are free to apply heuristic caching (RFC 7234)
    // to a bare 200 response with no Cache-Control/Expires, and will happily
    // serve an old response body for the identical URL (e.g. this exact
    // sort=recent&limit=24 request) days later without ever hitting this
    // route again. This response depends on `sort`, on whether the caller is
    // logged in, and on data that changes every sync run — it must never be
    // cached by the browser or any shared/CDN cache. Application-level
    // freshness is already handled by the Redis/in-memory `cache` layer
    // inside SearchService with its own explicit TTL; this header only
    // stops browsers from second-guessing that with their own caching.
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return fail(error);
  }
}

