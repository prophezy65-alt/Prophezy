import { getServiceClient } from '../db/client';
import { cache, cacheKey } from '../db/cache';
import { CACHE_TTL_SECONDS } from '../config/constants';
import { EngineError } from '../utils/errors';
import { SyncRepository } from '../db/repositories';
import { listDescriptors } from '../providers';
import { isoDaysAgo } from '../utils/date';

export interface TopItem {
  key: string;
  label: string;
  count: number;
}

export interface AnalyticsOverview {
  totals: {
    activeInternships: number;
    companies: number;
    providersActive: number;
    providersUnsupported: number;
  };
  mostViewed: TopItem[];
  trendingCompanies: TopItem[];
  trendingRoles: TopItem[];
  popularSkills: TopItem[];
  conversion: {
    views: number;
    applications: number;
    offers: number;
    viewToApply: number;
    applyToOffer: number;
  };
  engagement: {
    activeUsers7d: number;
    savedTotal: number;
    applicationsTotal: number;
  };
  sync: {
    lastRunAt: string | null;
    runs24h: number;
    failures24h: number;
  };
  generatedAt: string;
}

/**
 * Reads from SQL views defined in the migration rather than aggregating in
 * application code — the database is far better at this and it keeps the
 * endpoint fast enough to serve uncached under load.
 */
export class AnalyticsService {
  constructor(private readonly syncRepo = new SyncRepository()) {}

  private get db() {
    return getServiceClient();
  }

  async overview(): Promise<AnalyticsOverview> {
    const key = cacheKey('analytics', { scope: 'overview' });
    return cache.remember(key, CACHE_TTL_SECONDS.analytics, async () => {
      const [
        activeInternships,
        companies,
        mostViewed,
        trendingCompanies,
        trendingRoles,
        popularSkills,
        conversion,
        engagement,
        runs,
      ] = await Promise.all([
        this.count('internships', (q) => q.eq('is_active', true)),
        this.count('companies'),
        this.topView('v_most_viewed_internships', 'title', 10),
        this.topView('v_trending_companies', 'company_name', 10),
        this.topView('v_trending_roles', 'normalized_title', 10),
        this.topView('v_popular_skills', 'skill', 20),
        this.conversionMetrics(),
        this.engagementMetrics(),
        this.syncRepo.recentRuns(200),
      ]);

      const descriptors = listDescriptors();
      const since = isoDaysAgo(1);
      const runs24h = runs.filter((r) => r.startedAt >= since);

      return {
        totals: {
          activeInternships,
          companies,
          providersActive: descriptors.filter((d) => d.status === 'active').length,
          providersUnsupported: descriptors.filter((d) => d.status === 'unsupported').length,
        },
        mostViewed,
        trendingCompanies,
        trendingRoles,
        popularSkills,
        conversion,
        engagement,
        sync: {
          lastRunAt: runs[0]?.startedAt ?? null,
          runs24h: runs24h.length,
          failures24h: runs24h.filter((r) => r.status === 'failed').length,
        },
        generatedAt: new Date().toISOString(),
      };
    });
  }

  async providerHealth(): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.db
      .from('providers')
      .select('*')
      .order('checked_at', { ascending: false });
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data ?? []) as Array<Record<string, unknown>>;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private async count(table: string, refine?: (q: any) => any): Promise<number> {
    let query = this.db.from(table).select('*', { count: 'exact', head: true });
    if (refine) query = refine(query);
    const { count, error } = await query;
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return count ?? 0;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  private async topView(view: string, labelColumn: string, limit: number): Promise<TopItem[]> {
    const { data, error } = await this.db.from(view).select('*').limit(limit);
    if (error) return [];
    return (data as Array<Record<string, unknown>>).map((row) => ({
      key: String(row.id ?? row[labelColumn] ?? ''),
      label: String(row[labelColumn] ?? 'Unknown'),
      count: Number(row.count ?? row.total ?? 0),
    }));
  }

  private async conversionMetrics(): Promise<AnalyticsOverview['conversion']> {
    const { data, error } = await this.db.from('v_conversion_funnel').select('*').maybeSingle();
    if (error || !data) {
      return { views: 0, applications: 0, offers: 0, viewToApply: 0, applyToOffer: 0 };
    }
    const row = data as Record<string, unknown>;
    const views = Number(row.views ?? 0);
    const applications = Number(row.applications ?? 0);
    const offers = Number(row.offers ?? 0);
    return {
      views,
      applications,
      offers,
      viewToApply: views > 0 ? round(applications / views) : 0,
      applyToOffer: applications > 0 ? round(offers / applications) : 0,
    };
  }

  private async engagementMetrics(): Promise<AnalyticsOverview['engagement']> {
    const [saved, applications, activeUsers] = await Promise.all([
      this.count('saved_internships'),
      this.count('applications'),
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      this.count('applications', (q: any) => q.gte('updated_at', isoDaysAgo(7))),
    ]);
    return { activeUsers7d: activeUsers, savedTotal: saved, applicationsTotal: applications };
  }
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
