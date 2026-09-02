import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { buildUrl } from '../../utils/http';
import { toIso } from '../../utils/date';
import { buildCompensation } from '../../utils/money';
import type { Currency } from '../../types';

interface AdzunaJob {
  id: string;
  title: string;
  description?: string;
  created?: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  contract_type?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
}

interface AdzunaResponse { results?: AdzunaJob[]; count?: number }

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'adzuna') as ProviderDescriptor;

/** Country code -> Adzuna currency. Adzuna returns salaries in local currency. */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  in: 'INR', gb: 'GBP', us: 'USD', ca: 'CAD', au: 'AUD', sg: 'SGD',
  de: 'EUR', fr: 'EUR', nl: 'EUR', es: 'EUR', it: 'EUR', at: 'EUR', pl: 'EUR',
};

export class AdzunaProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  private countries(): string[] {
    const configured = (process.env.ADZUNA_COUNTRIES ?? 'in,us,gb')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return configured;
  }

  protected healthUrl(): string {
    return this.endpoint(this.countries()[0] as string, 1, { query: 'intern', perPage: 1 });
  }

  private endpoint(country: string, page: number, options: FetchOptions): string {
    return buildUrl(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`, {
      app_id: process.env.ADZUNA_APP_ID,
      app_key: process.env.ADZUNA_APP_KEY,
      results_per_page: Math.min(options.perPage ?? 50, 50),
      what: options.query ?? 'internship',
      where: options.location,
      max_days_old: options.since
        ? Math.max(1, Math.ceil((Date.now() - new Date(options.since).getTime()) / 86_400_000))
        : 14,
      // Removed: content_type: 'application/json' — this is not a
      // documented Adzuna query parameter. It looks like a mix-up with the
      // Content-Type *request header* (meaningless here anyway — this is a
      // GET request with no body) and is the leading suspect for the
      // HTTP 400s every country/page was failing with. Adzuna's actual
      // documented params for this endpoint are: app_id, app_key,
      // results_per_page, what, where, distance, max_days_old,
      // salary_min/max, salary_include_unknown, full_time, part_time,
      // permanent, contract, sort_by — content_type isn't among them.
    });
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const items: NormalizedInternship[] = [];
    const maxPages = Math.min(options.page ?? 3, 5);

    for (const country of this.countries()) {
      for (let page = 1; page <= maxPages; page += 1) {
        let response: AdzunaResponse;
        try {
          response = await this.request<AdzunaResponse>(this.endpoint(country, page, options), {
            signal: options.signal,
          });
        } catch (error) {
          this.warn(`country "${country}" page ${page} failed: ${(error as Error).message}`);
          break;
        }

        const results = response.results ?? [];
        this.rawCount += results.length;
        if (results.length === 0) break;

        for (const job of results) {
          if (!looksLikeInternship(job.title, job.description ?? '')) continue;
          items.push(this.toPosting(job, country));
        }
        if (options.maxItems && items.length >= options.maxItems) return items;
      }
    }
    return items;
  }

  private toPosting(job: AdzunaJob, country: string): NormalizedInternship {
    const currency = COUNTRY_CURRENCY[country] ?? null;
    const hasSalary = job.salary_min !== undefined || job.salary_max !== undefined;

    const raw: RawPosting = {
      provider: this.descriptor.key,
      externalId: job.id,
      title: job.title,
      companyName: job.company?.display_name ?? 'Undisclosed company',
      locationRaw: job.location?.display_name ?? (job.location?.area ?? []).join(', '),
      descriptionText: job.description ?? '',
      applyUrl: job.redirect_url,
      postedAt: toIso(job.created),
      durationRaw: job.contract_time ?? job.contract_type ?? null,
      compensation: hasSalary
        ? buildCompensation(job.salary_min ?? null, job.salary_max ?? null, currency, 'year', null)
        : null,
      tags: [job.category?.label, `adzuna-${country}`].filter(Boolean) as string[],
      confidence: 0.75,
    };
    return buildPosting(raw);
  }
}
