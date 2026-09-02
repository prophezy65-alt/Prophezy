import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS, KNOWN_ATS_BOARDS } from '../../config/provider-registry';
import { getConfiguredBoards } from '../../config/companies';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor, WorkMode } from '../../types';
import { toIso } from '../../utils/date';
import { mapWithConcurrency } from '../../utils/retry';
import { parseCompensation } from '../../utils/money';

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  workplaceType?: string;
  categories?: { commitment?: string; location?: string; team?: string; department?: string };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
  lists?: Array<{ text: string; content: string }>;
}

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'lever') as ProviderDescriptor;

/** Lever public Postings API — https://api.lever.co/v0/postings/{site}?mode=json */
export class LeverProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  private sites(): string[] {
    const fromEnv = (process.env.LEVER_SITES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const fromConfig = getConfiguredBoards('lever');
    const merged = [...new Set([...fromEnv, ...fromConfig])];
    return merged.length > 0 ? merged : KNOWN_ATS_BOARDS.lever;
  }

  override isConfigured(): boolean {
    return this.sites().length > 0;
  }

  protected healthUrl(): string {
    return `https://api.lever.co/v0/postings/${this.sites()[0]}?mode=json&limit=1`;
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const results = await mapWithConcurrency(
      this.sites(),
      this.descriptor.rateLimit.concurrency,
      (site) => this.collectSite(site, options),
    );
    const items: NormalizedInternship[] = [];
    results.forEach((result, index) => {
      if (result.ok) items.push(...result.value);
      else this.warn(`site "${this.sites()[index]}" failed: ${(result.error as Error).message}`);
    });
    return items;
  }

  private async collectSite(site: string, options: FetchOptions): Promise<NormalizedInternship[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json&limit=200`;
    const postings = await this.request<LeverPosting[]>(url, { signal: options.signal });
    this.rawCount += postings.length;

    const since = options.since ? new Date(options.since).getTime() : null;

    return postings
      .filter((p) => {
        if (since && p.createdAt && p.createdAt < since) return false;
        const commitment = p.categories?.commitment ?? '';
        return looksLikeInternship(`${p.text} ${commitment}`, p.descriptionPlain ?? '');
      })
      .map((p) => {
        const listsText = (p.lists ?? []).map((l) => `${l.text}\n${l.content}`).join('\n');
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: p.id,
          title: p.text,
          companyName: prettify(site),
          locationRaw: p.categories?.location ?? null,
          descriptionHtml: `${p.description ?? ''}\n${listsText}`,
          descriptionText: p.descriptionPlain,
          applyUrl: p.applyUrl ?? p.hostedUrl,
          postedAt: toIso(p.createdAt),
          durationRaw: p.categories?.commitment ?? null,
          workModeHint: mapWorkplaceType(p.workplaceType),
          compensation: p.salaryRange
            ? parseCompensation(
                `${p.salaryRange.currency ?? ''} ${p.salaryRange.min ?? ''} ${p.salaryRange.max ?? ''} per ${p.salaryRange.interval ?? 'year'}`,
              )
            : null,
          tags: [p.categories?.team, p.categories?.department].filter(Boolean) as string[],
          confidence: 0.95,
        };
        return buildPosting(raw);
      });
  }
}

function mapWorkplaceType(value: string | undefined): WorkMode | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v.includes('remote')) return 'remote';
  if (v.includes('hybrid')) return 'hybrid';
  if (v.includes('onsite') || v.includes('on-site')) return 'onsite';
  return null;
}

function prettify(site: string): string {
  return site.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
