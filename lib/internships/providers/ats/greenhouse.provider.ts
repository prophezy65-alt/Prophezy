import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS, KNOWN_ATS_BOARDS } from '../../config/provider-registry';
import { getConfiguredBoards } from '../../config/companies';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { toIso } from '../../utils/date';
import { mapWithConcurrency } from '../../utils/retry';

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  content?: string;
  location?: { name?: string };
  metadata?: Array<{ name: string; value: string | string[] | null }>;
}

interface GreenhouseResponse { jobs?: GreenhouseJob[] }

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'greenhouse') as ProviderDescriptor;

/** Greenhouse public Job Board API — https://boards-api.greenhouse.io/v1/boards/{token}/jobs */
export class GreenhouseProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  private boards(): string[] {
    const fromEnv = (process.env.GREENHOUSE_BOARD_TOKENS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const fromConfig = getConfiguredBoards('greenhouse');
    const merged = [...new Set([...fromEnv, ...fromConfig])];
    return merged.length > 0 ? merged : KNOWN_ATS_BOARDS.greenhouse;
  }

  override isConfigured(): boolean {
    return this.boards().length > 0;
  }

  protected healthUrl(): string {
    return `https://boards-api.greenhouse.io/v1/boards/${this.boards()[0]}/jobs`;
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
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
    const response = await this.request<GreenhouseResponse>(url, { signal: options.signal });
    const jobs = response.jobs ?? [];
    this.rawCount += jobs.length;

    const since = options.since ? new Date(options.since).getTime() : null;

    return jobs
      .filter((job) => {
        if (since) {
          const updated = job.updated_at ? new Date(job.updated_at).getTime() : null;
          if (updated !== null && updated < since) return false;
        }
        return looksLikeInternship(job.title, decodeContent(job.content));
      })
      .map((job) => {
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: String(job.id),
          title: job.title,
          companyName: prettifyBoard(board),
          companyWebsite: `https://${board}.com`,
          locationRaw: job.location?.name ?? null,
          descriptionHtml: decodeContent(job.content),
          applyUrl: job.absolute_url,
          postedAt: toIso(job.updated_at),
          confidence: 0.95,
        };
        return buildPosting(raw);
      });
  }
}

/** Greenhouse HTML-encodes the `content` field. */
function decodeContent(content: string | undefined): string {
  if (!content) return '';
  return content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function prettifyBoard(board: string): string {
  return board.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
