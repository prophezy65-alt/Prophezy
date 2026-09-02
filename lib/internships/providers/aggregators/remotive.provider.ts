import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { buildUrl } from '../../utils/http';
import { toIso } from '../../utils/date';
import { parseCompensation } from '../../utils/money';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name?: string;
  company_logo?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
  tags?: string[];
}

interface RemotiveResponse { jobs?: RemotiveJob[] }

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'remotive') as ProviderDescriptor;

export class RemotiveProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  override isConfigured(): boolean {
    return true;
  }

  protected healthUrl(): string {
    return 'https://remotive.com/api/remote-jobs?limit=1';
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const url = buildUrl('https://remotive.com/api/remote-jobs', {
      search: options.query ?? 'intern',
      limit: Math.min(options.maxItems ?? 200, 500),
    });
    const response = await this.request<RemotiveResponse>(url, { signal: options.signal });
    const jobs = response.jobs ?? [];
    this.rawCount = jobs.length;
    const since = options.since ? new Date(options.since).getTime() : null;

    return jobs
      .filter((job) => {
        if (since && job.publication_date && new Date(job.publication_date).getTime() < since) return false;
        return looksLikeInternship(`${job.title} ${job.job_type ?? ''}`, job.description ?? '');
      })
      .map((job) => {
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: String(job.id),
          title: job.title,
          companyName: job.company_name ?? 'Undisclosed company',
          companyLogo: job.company_logo ?? null,
          locationRaw: job.candidate_required_location ?? 'Remote',
          descriptionHtml: job.description ?? null,
          applyUrl: job.url,
          postedAt: toIso(job.publication_date),
          workModeHint: 'remote',
          compensation: job.salary ? parseCompensation(job.salary) : null,
          tags: [...(job.tags ?? []), job.category].filter(Boolean) as string[],
          confidence: 0.85,
        };
        return buildPosting(raw);
      });
  }
}
