import type {
  InternshipRecord,
  Page,
  SearchHit,
  SearchRequest,
  SortKey,
} from '../types';
import { InternshipRepository, UserRepository } from '../db/repositories';
import { RankingService } from './ranking.service';
import { getAIRunner } from '../ai/engine.adapter';
import { cache, cacheKey } from '../db/cache';
import { CACHE_TTL_SECONDS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';
import { createLogger } from '../utils/logger';
import { cosineSimilarity, tokenize } from '../utils/text';
import { sanitizeForPrompt } from '../utils/validation';

const log = createLogger('internships.search');

/**
 * Sorts backed by a single authoritative database column. Picking one of
 * these is an explicit request for that exact order — once repo.list() has
 * produced it, nothing downstream (semantic/hybrid re-ranking, personalize())
 * is allowed to reorder the page.
 *
 * 'relevance' (default "Most relevant") and 'match_score' ("Best match") are
 * intentionally excluded: both ask for relevance/personalization-driven
 * ordering, so re-ranking them is the whole point, not a bug.
 */
const EXPLICIT_ORDER_SORTS: ReadonlySet<SortKey> = new Set([
  'recent',
  'deadline',
  'stipend_desc',
  'stipend_asc',
]);

interface Cursor {
  offset: number;
}

export class SearchService {
  constructor(
    private readonly repo = new InternshipRepository(),
    private readonly users = new UserRepository(),
    private readonly ranking = new RankingService(),
  ) {}

  async search(request: SearchRequest): Promise<Page<SearchHit<InternshipRecord>>> {
    const startedAt = Date.now();
    const limit = Math.min(request.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = decodeCursor(request.cursor).offset;
    const sort = request.sort ?? 'relevance';
    const isExplicitOrderSort = EXPLICIT_ORDER_SORTS.has(sort);
    // Semantic/hybrid retrieval is fundamentally similarity-ranked, so it
    // can't honor a strict column ordering like "Newest"/"Deadline soon"/
    // stipend high-low. When the user has explicitly picked one of those
    // sorts, always resolve to the keyword path: repo.list() is the single
    // source of truth for how each SortKey maps to a database ORDER BY, and
    // it still applies request.q as a text filter — just without the
    // relevance-blended re-ranking that hybrid/semantic would otherwise do.
    const mode = isExplicitOrderSort ? 'keyword' : request.mode ?? (request.q ? 'hybrid' : 'keyword');
    const filters = { activeOnly: true, ...request.filters };

    const key = cacheKey('search', { ...request, limit, offset, mode });
    const cached = await cache.get<Page<SearchHit<InternshipRecord>>>(key);
    if (cached) return { ...cached, tookMs: Date.now() - startedAt };

    let hits: SearchHit<InternshipRecord>[];
    let total: number | null;

    if (mode === 'semantic' && request.q) {
      hits = await this.semantic(request.q, filters, limit + offset);
      hits = hits.slice(offset, offset + limit);
      total = null;
    } else if (mode === 'hybrid' && request.q) {
      const [keywordPage, semanticHits] = await Promise.all([
        this.keyword(request.q, filters, sort, limit + offset, 0),
        this.semantic(request.q, filters, limit + offset).catch((error: unknown) => {
          log.warn('semantic leg failed; serving keyword-only results', {
            error: (error as Error).message,
          });
          return [] as SearchHit<InternshipRecord>[];
        }),
      ]);
      hits = fuseRankings(keywordPage.hits, semanticHits).slice(offset, offset + limit);
      total = keywordPage.total;
    } else {
      const page = await this.keyword(request.q ?? null, filters, sort, limit, offset);
      hits = page.hits;
      total = page.total;
    }

    // Explicit "Newest"/"Deadline soon"/stipend sorts must keep the database
    // ordering repo.list() already produced — personalization still runs (it
    // still annotates score/matchedOn, e.g. for a "% match" badge in the UI)
    // but is told not to reorder the page when isExplicitOrderSort is true.
    if (request.userId) hits = await this.personalize(hits, request.userId, isExplicitOrderSort);

    const result: Page<SearchHit<InternshipRecord>> = {
      items: hits,
      nextCursor: hits.length === limit ? encodeCursor({ offset: offset + limit }) : null,
      total,
      tookMs: Date.now() - startedAt,
    };

    await cache.set(key, result, CACHE_TTL_SECONDS.search);
    return result;
  }

  private async keyword(
    q: string | null,
    filters: SearchRequest['filters'],
    sort: NonNullable<SearchRequest['sort']>,
    limit: number,
    offset: number,
  ): Promise<{ hits: SearchHit<InternshipRecord>[]; total: number | null }> {
    // Company diversity only applies to the default "relevance" browse
    // order, and only when the user isn't already filtering to a specific
    // company — if they picked "Newest"/"Deadline soon"/stipend sorts, or
    // filtered to one company on purpose, that's an explicit choice and
    // re-ordering it would be wrong, not helpful.
    const shouldDiversify = sort === 'relevance' && !filters?.company?.length;

    if (!shouldDiversify) {
      const { items, total } = await this.repo.list({ filters: filters ?? {}, sort, limit, offset, q });
      return { hits: this.toHits(items, q), total };
    }

    // Fetch a candidate window from the TOP of the ranking (offset 0, not
    // this page's own offset) so the diversity interleave is stable and
    // consistent across pages, then slice out the page actually requested.
    // Bounded by MAX_PAGE_SIZE per repo.list() call — a single company
    // legitimately having the highest quality_score rows is not something
    // sorting can fix; this round-robins across companies instead of
    // trusting quality_score alone to produce a varied first page.
    //
    // Known limitation: once offset + limit exceeds MAX_PAGE_SIZE (i.e.
    // fairly deep pagination), the window can't grow further in one query
    // and this falls back to the plain ranked order for that page rather
    // than doing a second round-trip. Acceptable for an infinite-scroll
    // browse experience where most engagement is on the first few pages.
    const windowSize = Math.min(offset + limit * 6, MAX_PAGE_SIZE);
    const withinWindow = offset + limit <= windowSize;

    const { items, total } = await this.repo.list({
      filters: filters ?? {},
      sort,
      limit: withinWindow ? windowSize : limit,
      offset: withinWindow ? 0 : offset,
      q,
    });

    const page = withinWindow ? diversifyByCompany(items).slice(offset, offset + limit) : items;
    return { hits: this.toHits(page, q), total };
  }

  private toHits(items: InternshipRecord[], q: string | null): SearchHit<InternshipRecord>[] {
    const queryTokens = q ? tokenize(q) : [];
    return items.map((item) => ({
      item,
      score: this.ranking.rankingScore(item),
      matchedOn: queryTokens.length > 0 ? matchedFields(item, queryTokens) : ['filters'],
    }));
  }

  private async semantic(
    q: string,
    filters: SearchRequest['filters'],
    limit: number,
  ): Promise<SearchHit<InternshipRecord>[]> {
    const [embedding] = await getAIRunner().embed(sanitizeForPrompt(q, 1_000));
    if (!embedding) return [];

    const matches = await this.repo.semanticSearch(embedding, limit, filters ?? {});
    return matches.map(({ item, similarity }) => ({
      item,
      score: Math.round(similarity * 100),
      matchedOn: ['semantic'],
    }));
  }

  /**
   * Re-ranks a page against the caller's profile without a model call.
   *
   * When `preserveOrder` is true (the caller picked an explicit
   * database-ordered sort — see EXPLICIT_ORDER_SORTS) this still computes and
   * attaches the personalized score for each hit, but returns them in the
   * same order they arrived in. It must NOT sort in that case: doing so is
   * exactly the bug where picking "Newest" silently got re-ordered by
   * relevance score after the fact.
   */
  private async personalize(
    hits: SearchHit<InternshipRecord>[],
    userId: string,
    preserveOrder: boolean,
  ): Promise<SearchHit<InternshipRecord>[]> {
    try {
      const profile = await this.users.getProfile(userId);
      const scored = hits.map((hit) => {
        const personal = this.ranking.heuristicMatch(hit.item, profile);
        const resumeSimilarity =
          profile.resumeEmbedding && hit.item.embedding
            ? cosineSimilarity(profile.resumeEmbedding, hit.item.embedding) * 100
            : personal;
        return {
          ...hit,
          score: Math.round(hit.score * 0.4 + personal * 0.4 + resumeSimilarity * 0.2),
          matchedOn: [...hit.matchedOn, 'profile'],
        };
      });
      return preserveOrder ? scored : scored.sort((a, b) => b.score - a.score);
    } catch (error) {
      log.warn('personalization skipped', { userId, error: (error as Error).message });
      return hits;
    }
  }

  async backfillEmbeddings(limit: number): Promise<number> {
    const missing = await this.repo.findMissingEmbeddings(limit);
    if (missing.length === 0) return 0;

    const runner = getAIRunner();
    const entries: Array<{ id: string; embedding: number[] }> = [];
    for (const item of missing) {
      const [embedding] = await runner.embed(sanitizeForPrompt(`${item.title}\n${item.description}`, 2_000));
      if (embedding) entries.push({ id: item.id, embedding });
    }
    await this.repo.setEmbeddings(entries);
    return entries.length;
  }
}

/**
 * Round-robin reorder: takes items in their existing (quality-ranked) order
 * and interleaves across companies so consecutive results don't repeat the
 * same company back-to-back, without changing the relative quality order
 * within any single company's own postings. This — not sorting — is what
 * actually fixes "the first page is dominated by one company": a company
 * with many well-structured postings can legitimately hold the top N
 * highest quality_score rows outright, no matter how good other companies'
 * individual postings are.
 */
function diversifyByCompany(items: InternshipRecord[]): InternshipRecord[] {
  const buckets = new Map<string, InternshipRecord[]>();
  for (const item of items) {
    const key = item.company.slug || item.company.name;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  // Insertion order of `buckets` follows the input's quality order, since
  // each company's first-seen item is its highest-ranked one — so `order`
  // itself is already "best company first," which is what we want round 0
  // of the interleave to reflect.
  const order = [...buckets.keys()];
  const result: InternshipRecord[] = [];
  let round = 0;
  while (result.length < items.length) {
    let addedThisRound = false;
    for (const key of order) {
      const bucket = buckets.get(key)!;
      if (round < bucket.length) {
        result.push(bucket[round]!);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round += 1;
  }
  return result;
}

function decodeCursor(cursor: string | null | undefined): Cursor {
  if (!cursor) return { offset: 0 };
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    return { offset: typeof decoded.offset === 'number' ? decoded.offset : 0 };
  } catch {
    return { offset: 0 };
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function matchedFields(item: InternshipRecord, tokens: readonly string[]): string[] {
  const fields: string[] = [];
  const title = item.normalizedTitle.toLowerCase();
  const skills = item.skills.map((s) => s.toLowerCase());
  for (const token of tokens) {
    if (title.includes(token)) fields.push('title');
    if (skills.some((s) => s.includes(token))) fields.push('skills');
  }
  return [...new Set(fields)];
}

function fuseRankings(
  keywordHits: SearchHit<InternshipRecord>[],
  semanticHits: SearchHit<InternshipRecord>[],
): SearchHit<InternshipRecord>[] {
  const byId = new Map<string, SearchHit<InternshipRecord>>();
  for (const hit of keywordHits) byId.set(hit.item.id, hit);
  for (const hit of semanticHits) {
    const existing = byId.get(hit.item.id);
    if (existing) {
      existing.score = Math.round(existing.score * 0.6 + hit.score * 0.4);
      existing.matchedOn = [...new Set([...existing.matchedOn, ...hit.matchedOn])];
    } else {
      byId.set(hit.item.id, hit);
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}
