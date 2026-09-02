import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { buildUrl } from '../../utils/http';
import { toIso } from '../../utils/date';

interface ArbeitnowJob {
  slug: string;
  company_name?: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  // Declared as string[] in Arbeitnow's docs, but the live API has been
  // observed returning a bare string for some postings instead of a
  // single-element array — hence the defensive normalization below rather
  // than trusting this type at runtime.
  job_types?: string[] | string;
  location?: string;
  created_at?: number;
  visa_sponsorship?: boolean;
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
  links?: { next?: string | null };
}

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'arbeitnow') as ProviderDescriptor;

export class ArbeitnowProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  override isConfigured(): boolean {
    return true;
  }

  protected healthUrl(): string {
    return 'https://www.arbeitnow.com/api/job-board-api';
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const items: NormalizedInternship[] = [];
    const maxPages = Math.min(options.page ?? 3, 10);
    const since = options.since ? new Date(options.since).getTime() : null;

    for (let page = 1; page <= maxPages; page += 1) {
      let response: ArbeitnowResponse;
      try {
        response = await this.request<ArbeitnowResponse>(
          buildUrl('https://www.arbeitnow.com/api/job-board-api', { page }),
          { signal: options.signal },
        );
      } catch (error) {
        this.warn(`page ${page} failed: ${(error as Error).message}`);
        break;
      }

      const jobs = response.data ?? [];
      this.rawCount += jobs.length;
      if (jobs.length === 0) break;

      for (const job of jobs) {
        if (since && job.created_at && job.created_at * 1000 < since) continue;
        // job_types is typed as string[] but the live API has been observed
        // sending a bare string for some postings — this was crashing the
        // whole provider run with "(job.job_types ?? []).join is not a
        // function" the moment one such job showed up in a page of results.
        const jobTypes = Array.isArray(job.job_types)
          ? job.job_types
          : job.job_types
            ? [job.job_types]
            : [];
        const typeText = jobTypes.join(' ');
        if (!looksLikeInternship(`${job.title} ${typeText}`, job.description ?? '')) continue;

        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: job.slug,
          title: job.title,
          companyName: job.company_name ?? 'Undisclosed company',
          locationRaw: job.location ?? null,
          descriptionHtml: job.description ?? null,
          applyUrl: job.url,
          postedAt: toIso(job.created_at),
          workModeHint: job.remote ? 'remote' : null,
          tags: [
            ...(job.tags ?? []),
            ...(job.visa_sponsorship ? ['visa-sponsorship'] : []),
          ],
          confidence: 0.75,
        };
        items.push(buildPosting(raw));
      }
      if (!response.links?.next) break;
      if (options.maxItems && items.length >= options.maxItems) break;
    }
    return items;
  }
}
