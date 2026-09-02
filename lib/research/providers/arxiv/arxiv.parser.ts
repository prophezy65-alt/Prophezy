/**
 * lib/research/providers/arxiv/arxiv.parser.ts
 *
 * arXiv's search API (export.arxiv.org/api/query) returns an Atom
 * XML feed. This module turns that feed into ArxivRawEntry[] only —
 * no normalization to the canonical Paper type happens here, that's
 * arxiv.provider.ts's job. Keeping XML parsing isolated means the
 * one external dependency (fast-xml-parser) is confined to this file.
 *
 * Requires: npm install fast-xml-parser
 */

import { XMLParser } from 'fast-xml-parser';
import { ProviderRequestError } from '../../utils/errors';
import type { ArxivRawEntry } from './arxiv.types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['entry', 'author', 'category', 'link'].includes(name),
});

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractArxivId(idUrl: string): string {
  // "http://arxiv.org/abs/2107.03374v1" -> "2107.03374v1"
  const parts = idUrl.split('/abs/');
  return parts[1] ?? idUrl;
}

export function parseArxivFeed(xml: string): {
  entries: ArxivRawEntry[];
  totalResults?: number;
} {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    throw new ProviderRequestError(
      'arxiv',
      'Failed to parse Atom XML response',
      undefined,
      err,
    );
  }

  const feed = parsed?.feed as Record<string, unknown> | undefined;
  if (!feed) {
    throw new ProviderRequestError('arxiv', 'Unexpected feed shape: missing <feed>');
  }

  const totalResultsRaw = feed['opensearch:totalResults'];
  const totalResults =
    totalResultsRaw !== undefined ? Number(totalResultsRaw) : undefined;

  const rawEntries = toArray(feed.entry as unknown[]);

  const entries: ArxivRawEntry[] = rawEntries.map((rawEntryUnknown) => {
    const rawEntry = rawEntryUnknown as Record<string, unknown>;

    const authors = toArray(rawEntry.author as unknown[]).map((a) => ({
      name: (a as Record<string, unknown>).name as string,
    }));

    const categories = toArray(rawEntry.category as unknown[]).map(
      (c) => (c as Record<string, unknown>)['@_term'] as string,
    );

    const links = toArray(rawEntry.link as unknown[]).map((l) => {
      const link = l as Record<string, unknown>;
      return {
        href: link['@_href'] as string,
        rel: link['@_rel'] as string,
        type: link['@_type'] as string | undefined,
        title: link['@_title'] as string | undefined,
      };
    });

    const primaryCategoryNode = rawEntry['arxiv:primary_category'] as
      | Record<string, unknown>
      | undefined;

    return {
      id: rawEntry.id as string,
      title: (rawEntry.title as string)?.trim().replace(/\s+/g, ' '),
      summary: (rawEntry.summary as string)?.trim().replace(/\s+/g, ' '),
      authors,
      published: rawEntry.published as string,
      updated: rawEntry.updated as string,
      categories,
      primaryCategory: primaryCategoryNode?.['@_term'] as string | undefined,
      doi: (rawEntry['arxiv:doi'] as string) ?? undefined,
      links,
    };
  });

  return { entries, totalResults };
}
