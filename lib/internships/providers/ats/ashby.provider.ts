import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS, KNOWN_ATS_BOARDS } from '../../config/provider-registry';
import { getConfiguredBoards } from '../../config/companies';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { toIso } from '../../utils/date';
import { mapWithConcurrency } from '../../utils/retry';
import { parseCompensation } from '../../utils/money';

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  isRemote?: boolean;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  compensation?: { summaryComponents?: Array<{ summary?: string }> };
}

interface AshbyResponse { jobs?: AshbyJob[] }

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'ashby') as ProviderDescriptor;

/** Ashby public job board API — https://api.ashbyhq.com/posting-api/job-board/{board} */
export class AshbyProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  private boards(): string[] {
    const fromEnv = (process.env.ASHBY_BOARDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const fromConfig = getConfiguredBoards('ashby');
    const merged = [...new Set([...fromEnv, ...fromConfig])];
    return merged.length > 0 ? merged : KNOWN_ATS_BOARDS.ashby;
  }

  override isConfigured(): boolean {
    return this.boards().length > 0;
  }

  protected healthUrl(): string {
    return `https://api.ashbyhq.com/posting-api/job-board/${this.boards()[0]}`;
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const results = await mapWithConcurrency(
      this.boards(),
      this.descriptor.rateLimit.concurrency,
      (board) => this.collectBoard(board, options),
    );
    const items: NormalizedInternship[] = [];
    results.forEach((result, index) => {
      if (result.ok) items.push(...result.value);
      else this.warn(`board "${this.boards()[index]}" failed: ${(result.error as Error).message}`);
    });
    return items;
  }

  private async collectBoard(board: string, options: FetchOptions): Promise<NormalizedInternship[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`;
    const response = await this.request<AshbyResponse>(url, { signal: options.signal });
    const jobs = response.jobs ?? [];
    this.rawCount += jobs.length;

    const since = options.since ? new Date(options.since).getTime() : null;

    return jobs
      .filter((job) => {
        if (since && job.publishedAt && new Date(job.publishedAt).getTime() < since) return false;
        return looksLikeInternship(`${job.title} ${job.employmentType ?? ''}`, job.descriptionPlain ?? '');
      })
      .map((job) => {
        const salarySummary = (job.compensation?.summaryComponents ?? [])
          .map((c) => c.summary)
          .filter(Boolean)
          .join(' ');
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: job.id,
          title: job.title,
          companyName: prettify(board),
          locationRaw: job.location ?? null,
          descriptionHtml: job.descriptionHtml ?? null,
          descriptionText: job.descriptionPlain ?? null,
          applyUrl: job.applyUrl ?? job.jobUrl ?? `https://jobs.ashbyhq.com/${board}/${job.id}`,
          postedAt: toIso(job.publishedAt),
          workModeHint: job.isRemote ? 'remote' : null,
          compensation: salarySummary ? parseCompensation(salarySummary) : null,
          tags: [job.department, job.team].filter(Boolean) as string[],
          confidence: 0.95,
        };
        return buildPosting(raw);
      });
  }
}

function prettify(board: string): string {
  return board.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
