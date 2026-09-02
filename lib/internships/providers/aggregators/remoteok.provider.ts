import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { toIso } from '../../utils/date';
import { buildCompensation } from '../../utils/money';

interface RemoteOkJob {
  id?: string;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
  /** the first element of the RemoteOK feed is a legal/attribution notice */
  legal?: string;
}

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'remoteok') as ProviderDescriptor;

/**
 * RemoteOK public feed. Their terms require the attribution back-link that ships
 * in the posting's `applyUrl`; do not strip it when rendering.
 */
export class RemoteOkProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  override isConfigured(): boolean {
    return true;
  }

  protected healthUrl(): string {
    return 'https://remoteok.com/api';
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const feed = await this.request<RemoteOkJob[]>('https://remoteok.com/api', { signal: options.signal });
    const jobs = feed.filter((entry) => !entry.legal && entry.position);
    this.rawCount = jobs.length;
    const since = options.since ? new Date(options.since).getTime() : null;

    return jobs
      .filter((job) => {
        if (since && job.epoch && job.epoch * 1000 < since) return false;
        return looksLikeInternship(job.position as string, job.description ?? '');
      })
      .map((job) => {
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: String(job.id ?? job.slug),
          title: job.position as string,
          companyName: job.company ?? 'Undisclosed company',
          companyLogo: job.company_logo ?? null,
          locationRaw: job.location || 'Remote',
          descriptionHtml: job.description ?? null,
          applyUrl: job.apply_url ?? job.url ?? `https://remoteok.com/remote-jobs/${job.slug ?? job.id}`,
          postedAt: toIso(job.date ?? job.epoch ?? null),
          workModeHint: 'remote',
          compensation:
            job.salary_min || job.salary_max
              ? buildCompensation(job.salary_min ?? null, job.salary_max ?? null, 'USD', 'year', null)
              : null,
          tags: job.tags ?? [],
          confidence: 0.7,
        };
        return buildPosting(raw);
      });
  }
}
