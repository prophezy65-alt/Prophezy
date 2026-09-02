import { BaseProvider } from '../base/base.provider';
import { buildPosting, looksLikeInternship, type RawPosting } from '../base/posting.builder';
import { IMPLEMENTED_PROVIDERS } from '../../config/provider-registry';
import type { FetchOptions, NormalizedInternship, ProviderDescriptor } from '../../types';
import { toIso } from '../../utils/date';
import { collapseWhitespace, stripHtml } from '../../utils/text';

const DESCRIPTOR = IMPLEMENTED_PROVIDERS.find((d) => d.key === 'weworkremotely') as ProviderDescriptor;
const FEED = 'https://weworkremotely.com/remote-jobs.rss';

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  region: string | null;
  company: string | null;
  guid: string;
}

export class WeWorkRemotelyProvider extends BaseProvider {
  readonly descriptor = DESCRIPTOR;

  override isConfigured(): boolean {
    return true;
  }

  protected healthUrl(): string {
    return FEED;
  }

  protected async collect(options: FetchOptions): Promise<NormalizedInternship[]> {
    const xml = await this.request<string>(FEED, { accept: 'text', signal: options.signal });
    const items = parseRss(xml);
    this.rawCount = items.length;
    const since = options.since ? new Date(options.since).getTime() : null;

    return items
      .filter((item) => {
        if (since && new Date(item.pubDate).getTime() < since) return false;
        return looksLikeInternship(item.title, item.description);
      })
      .map((item) => {
        // WWR titles are formatted "Company: Role"
        const [companyPart, ...rest] = item.title.split(':');
        const title = rest.length > 0 ? rest.join(':').trim() : item.title;
        const raw: RawPosting = {
          provider: this.descriptor.key,
          externalId: item.guid || item.link,
          title,
          companyName: item.company ?? (rest.length > 0 ? (companyPart as string).trim() : 'Undisclosed company'),
          locationRaw: item.region ?? 'Remote',
          descriptionHtml: item.description,
          applyUrl: item.link,
          postedAt: toIso(item.pubDate),
          workModeHint: 'remote',
          confidence: 0.7,
        };
        return buildPosting(raw);
      });
  }
}

/** Minimal, dependency-free RSS 2.0 reader. Handles CDATA and entity-escaped bodies. */
export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRe) ?? [];

  for (const block of blocks) {
    const title = tag(block, 'title');
    const link = tag(block, 'link');
    if (!title || !link) continue;
    items.push({
      title: collapseWhitespace(title),
      link: collapseWhitespace(link),
      description: tag(block, 'description') ?? '',
      pubDate: tag(block, 'pubDate') ?? '',
      region: tag(block, 'region'),
      company: tag(block, 'company'),
      guid: tag(block, 'guid') ?? link,
    });
  }
  return items;
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  if (!match?.[1]) return null;
  const value = match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1').trim();
  return value.includes('&lt;') ? stripHtml(value) : value;
}
