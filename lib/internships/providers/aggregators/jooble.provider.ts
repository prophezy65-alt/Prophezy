import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { toIso } from '../../utils/date';
import { parseCompensation } from '../../utils/money';

interface JoobleJob {
  title: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link: string;
  company?: string;
  updated?: string;
  id?: number;
}

interface JoobleResponse { totalCount?: number; jobs?: JoobleJob[] }

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'jooble') as ProviderDescriptor;

/** Jooble partner API — POST https://{lang}.jooble.org/api/{key} */
export class JoobleProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  private endpoint(): string {
    const host = process.env.JOOBLE_HOST ?? 'jooble.org';
    return `https://${host}/api/${process.env.JOOBLE_API_KEY ?? ''}`;
  }

  protected healthUrl(): string {
    return this.endpoint();
  }

  override async healthCheck(): ReturnType<BaseProvider['healthCheck']> {
    // Jooble only answers POST; reuse a minimal search as the probe.
    if (!this.isConfigured()) return super.healthCheck();
    const startedAt = Date.now();
    try {
      await this.request<JoobleResponse>(this.endpoint(), {
        method: 'POST',
        body: { keywords: 'internship', page: 1 },
        attempts: 1,
        timeoutMs: 8_000,
      });
      return {
        provider: this.descriptor.key,
        status: 'active',
        reachable: true,
        latencyMs: Date.now() - startedAt,
        message: 'OK',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        provider: this.descriptor.key,
        status: 'degraded',
        reachable: false,
        latencyMs: Date.now() - startedAt,
        message: (error as Error).message,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const items: NormalizedInternship[] = [];
    const maxPages = Math.min(options.page ?? 3, 5);
    const locations = (process.env.JOOBLE_LOCATIONS ?? 'India,United States')
      .split(',').map((s) => s.trim()).filter(Boolean);

    for (const location of locations) {
      for (let page = 1; page <= maxPages; page += 1) {
        let response: JoobleResponse;
        try {
          response = await this.request<JoobleResponse>(this.endpoint(), {
            method: 'POST',
            signal: options.signal,
            body: {
              keywords: options.query ?? 'internship',
              location: options.location ?? location,
              page,
              ResultOnPage: Math.min(options.perPage ?? 50, 50),
            },
          });
        } catch (error) {
          this.warn(`location "${location}" page ${page} failed: ${(error as Error).message}`);
          break;
        }

        const jobs = response.jobs ?? [];
        this.rawCount += jobs.length;
        if (jobs.length === 0) break;

        for (const job of jobs) {
          if (!looksLikeInternship(job.title, job.snippet ?? '')) continue;
          const raw: RawPosting = {
            provider: this.descriptor.key,
            externalId: String(job.id ?? job.link),
            title: job.title,
            companyName: job.company ?? job.source ?? 'Undisclosed company',
            locationRaw: job.location ?? location,
            descriptionHtml: job.snippet ?? null,
            applyUrl: job.link,
            postedAt: toIso(job.updated),
            durationRaw: job.type ?? null,
            compensation: job.salary ? parseCompensation(job.salary) : null,
            tags: job.source ? [`via-${job.source}`] : [],
            confidence: 0.6,
          };
          items.push(buildPosting(raw));
        }
        if (options.maxItems && items.length >= options.maxItems) return items;
      }
    }
    return items;
  }
}
