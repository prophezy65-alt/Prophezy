import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import { getConfiguredBoards } from '../../config/companies';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import type { AtsProviderKey } from '../../config/companies';
import { toIso } from '../../utils/date';
import { mapWithConcurrency } from '../../utils/retry';

/**
 * Workable public widget API — https://apply.workable.com/api/v1/widget/accounts/{slug}
 * Unauthenticated, read-only, no ToS issue: this is the exact endpoint
 * Workable's own embeddable careers-page widget calls on customers' sites.
 * Returns every published job for one account in a single response — no
 * pagination, matching the Greenhouse provider's shape.
 *
 * Field names below are taken from Workable's own API docs and the public
 * widget's documented response shape (title, shortcode, url, location.*,
 * department, published_on/created_at) — not guessed.
 */
interface WorkableLocation {
  location_str?: string;
  country?: string;
  city?: string;
  telecommuting?: boolean;
  workplace_type?: string; // "on_site" | "remote" | "hybrid"
}

interface WorkableJob {
  id?: string;
  title: string;
  full_title?: string;
  shortcode?: string;
  department?: string;
  url?: string;
  shortlink?: string;
  application_url?: string;
  location?: WorkableLocation;
  description?: string;
  requirements?: string;
  benefits?: string;
  employment_type?: string;
  published_on?: string;
  created_at?: string;
}

interface WorkableWidgetResponse {
  name?: string;
  jobs?: WorkableJob[];
}

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'workable') as ProviderDescriptor;

export class WorkableProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  /**
   * Workable account slugs, same zero-code pattern as the other ATS
   * providers: env var ∪ companies.json ('provider': 'workable').
   */
  private accounts(): string[] {
    const fromEnv = (process.env.WORKABLE_ACCOUNTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const fromConfig = getConfiguredBoards('workable' satisfies AtsProviderKey);
    return [...new Set([...fromEnv, ...fromConfig])];
  }

  override isConfigured(): boolean {
    return this.accounts().length > 0;
  }

  protected healthUrl(): string {
    return `https://apply.workable.com/api/v1/widget/accounts/${this.accounts()[0]}`;
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const results = await mapWithConcurrency(
      this.accounts(),
      this.descriptor.rateLimit.concurrency,
      (account) => this.collectAccount(account, options),
    );

    const items: NormalizedInternship[] = [];
    results.forEach((result, index) => {
      if (result.ok) items.push(...result.value);
      else this.warn(`account "${this.accounts()[index]}" failed: ${(result.error as Error).message}`);
    });
    return items;
  }

  private async collectAccount(account: string, options: FetchOptions): Promise<NormalizedInternship[]> {
    const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}?details=true`;
    const response = await this.request<WorkableWidgetResponse>(url, { signal: options.signal });
    const jobs = response.jobs ?? [];
    this.rawCount += jobs.length;

    const since = options.since ? new Date(options.since).getTime() : null;
    const companyName = response.name ?? prettifyAccount(account);

    return jobs
      .filter((job) => {
        if (since) {
          const posted = job.published_on ?? job.created_at;
          const postedMs = posted ? new Date(posted).getTime() : null;
          if (postedMs !== null && postedMs < since) return false;
        }
        const description = combinedDescription(job);
        return looksLikeInternship(job.title, description);
      })
      .map((job) => {
        const loc = job.location;
        const isRemote = Boolean(loc?.telecommuting) || loc?.workplace_type?.toLowerCase() === 'remote';
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: job.shortcode ?? job.id ?? job.url ?? job.title,
          title: job.title,
          companyName,
          companyWebsite: `https://${account}.workable.com`,
          locationRaw: loc?.location_str ?? loc?.city ?? (isRemote ? 'Remote' : null),
          descriptionHtml: combinedDescription(job),
          // application_url is the direct "apply" link when Workable exposes
          // it; url/shortlink otherwise still point at the specific job
          // posting, never a generic careers homepage.
          applyUrl: job.application_url ?? job.url ?? job.shortlink ?? `https://apply.workable.com/${account}`,
          postedAt: toIso(job.published_on ?? job.created_at),
          confidence: 0.9,
        };
        return buildPosting(raw);
      });
  }
}

function combinedDescription(job: WorkableJob): string {
  return [job.description, job.requirements, job.benefits].filter(Boolean).join('\n\n');
}

function prettifyAccount(account: string): string {
  return account.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
