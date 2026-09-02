import type { InternshipRecord, MatchResult, UserProfileSnapshot } from '../types';
import { InternshipRepository, RecommendationRepository, TrackingRepository, UserRepository } from '../db/repositories';
import { MatcherService } from './matcher.service';
import { RankingService } from './ranking.service';
import { cache, cacheKey } from '../db/cache';
import { CACHE_TTL_SECONDS } from '../config/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.recommendations');

export interface RecommendationBundle {
  match: MatchResult;
  internship: InternshipRecord;
}

export class RecommendationService {
  constructor(
    private readonly internships = new InternshipRepository(),
    private readonly users = new UserRepository(),
    private readonly tracking = new TrackingRepository(),
    private readonly matcher = new MatcherService(),
    private readonly ranking = new RankingService(),
    private readonly recommendations = new RecommendationRepository(),
  ) {}

  /**
   * Candidate generation -> heuristic pre-rank -> AI scoring on the shortlist.
   * Candidates are drawn from the user's declared preferences rather than the
   * whole corpus, which keeps the pipeline linear in the user's interests.
   */
  async forUser(userId: string, limit = 20, options: { force?: boolean } = {}): Promise<RecommendationBundle[]> {
    const key = cacheKey('recommendations', { userId, limit });
    if (!options.force) {
      const cached = await cache.get<RecommendationBundle[]>(key);
      if (cached) return cached;
    }

    const profile = await this.users.getProfile(userId);
    const candidates = await this.generateCandidates(profile);

    if (candidates.length === 0) {
      log.info('no candidates for user', { userId });
      return [];
    }

    const alreadyTracked = new Set(await this.tracking.listSavedIds(userId, 500));
    const fresh = candidates.filter((item) => !alreadyTracked.has(item.id));

    const matches = await this.matcher.matchMany(fresh, profile, { topN: Math.max(limit, 25) });
    const byId = new Map(fresh.map((item) => [item.id, item]));

    const bundles = matches
      .filter((match) => byId.has(match.internshipId))
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit)
      .map((match) => ({ match, internship: byId.get(match.internshipId) as InternshipRecord }));

    await cache.set(key, bundles, CACHE_TTL_SECONDS.recommendations);
    return bundles;
  }

  /** Precomputed recommendations, used by digests where latency matters more than freshness. */
  async cachedForUser(userId: string, limit = 10): Promise<MatchResult[]> {
    return this.recommendations.topForUser(userId, limit);
  }

  /**
   * "More like this" — same company, overlapping skills, or semantically near.
   * Uses the stored embedding when available and falls back to skill overlap.
   */
  async similarTo(internshipId: string, limit = 6): Promise<InternshipRecord[]> {
    const source = await this.internships.findById(internshipId);

    if (source.embedding) {
      const matches = await this.internships.semanticSearch(source.embedding, limit + 1, { activeOnly: true });
      return matches.map((m) => m.item).filter((item) => item.id !== internshipId).slice(0, limit);
    }

    const { items } = await this.internships.list({
      filters: { skills: source.skills.slice(0, 8), activeOnly: true },
      sort: 'relevance',
      limit: limit + 1,
      offset: 0,
    });
    return items.filter((item) => item.id !== internshipId).slice(0, limit);
  }

  private async generateCandidates(profile: UserProfileSnapshot): Promise<InternshipRecord[]> {
    const pools = await Promise.all([
      // Skill-driven pool
      profile.skills.length > 0
        ? this.internships.list({
            filters: { skills: profile.skills.slice(0, 12), activeOnly: true },
            sort: 'recent', limit: 60, offset: 0,
          })
        : Promise.resolve({ items: [], total: 0 }),
      // Location / work-mode pool
      this.internships.list({
        filters: {
          activeOnly: true,
          ...(profile.preferredLocations[0] ? { city: profile.preferredLocations[0] } : {}),
          ...(profile.preferredWorkModes.length
            ? { workMode: profile.preferredWorkModes as InternshipRecord['workMode'][] }
            : {}),
        },
        sort: 'recent', limit: 40, offset: 0,
      }),
      // Quality pool — high-signal postings regardless of stated preferences
      this.internships.list({
        filters: { activeOnly: true, ...(profile.minStipendInr ? { minStipendInr: profile.minStipendInr } : {}) },
        sort: 'relevance', limit: 40, offset: 0,
      }),
    ]);

    const deduped = new Map<string, InternshipRecord>();
    for (const pool of pools) {
      for (const item of pool.items) deduped.set(item.id, item);
    }

    return [...deduped.values()]
      .map((item) => ({ item, score: this.ranking.heuristicMatch(item, profile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 120)
      .map((entry) => entry.item);
  }
}
