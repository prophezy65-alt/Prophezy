import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { buildUrl } from '../../utils/http';
import { toIso } from '../../utils/date';

interface MuseJob {
  id: number;
  name: string;
  contents?: string;
  publication_date?: string;
  refs?: { landing_page?: string };
  company?: { name?: string };
  locations?: Array<{ name?: string }>;
  levels?: Array<{ name?: string; short_name?: string }>;
  categories?: Array<{ name?: string }>;
}

interface MuseResponse { results?: MuseJob[]; page_count?: number }

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'themuse') as ProviderDescriptor;

/** The Muse API v2 — https://www.themuse.com/api/public/jobs */
export class TheMuseProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  override isConfigured(): boolean {
    return true; // key optional
  }

  private endpoint(page: number, options: FetchOptions): string {
    return buildUrl('https://www.themuse.com/api/public/jobs', {
      page,
      level: 'Internship',
      location: options.location,
      api_key: process.env.THEMUSE_API_KEY,
    });
  }

  protected healthUrl(): string {
    return this.endpoint(0, {});
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const items: NormalizedInternship[] = [];
    const maxPages = Math.min(options.page ?? 5, 10);
    const since = options.since ? new Date(options.since).getTime() : null;

    for (let page = 0; page < maxPages; page += 1) {
      let response: MuseResponse;
      try {
        response = await this.request<MuseResponse>(this.endpoint(page, options), { signal: options.signal });
      } catch (error) {
        this.warn(`page ${page} failed: ${(error as Error).message}`);
        break;
      }

      const results = response.results ?? [];
      this.rawCount += results.length;
      if (results.length === 0) break;

      for (const job of results) {
        if (since && job.publication_date && new Date(job.publication_date).getTime() < since) continue;
        const isInternLevel = (job.levels ?? []).some((l) => /intern/i.test(l.name ?? ''));
        if (!isInternLevel && !looksLikeInternship(job.name, job.contents ?? '')) continue;

        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: String(job.id),
          title: job.name,
          companyName: job.company?.name ?? 'Undisclosed company',
          locationRaw: (job.locations ?? []).map((l) => l.name).filter(Boolean).join(' | ') || null,
          descriptionHtml: job.contents ?? null,
          applyUrl: job.refs?.landing_page ?? `https://www.themuse.com/jobs/${job.id}`,
          postedAt: toIso(job.publication_date),
          tags: (job.categories ?? []).map((c) => c.name).filter(Boolean) as string[],
          confidence: 0.85,
        };
        items.push(buildPosting(raw));
      }
      if (options.maxItems && items.length >= options.maxItems) break;
    }
    return items;
  }
}
