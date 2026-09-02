/**
 * lib/research/providers/arxiv/arxiv.types.ts
 *
 * Shapes internal to the arXiv provider only. Nothing outside this
 * folder should import from here — consumers use the normalized
 * `Paper` type from models/paper.types.ts instead.
 */

export interface ArxivRawEntry {
  id: string; // e.g. "http://arxiv.org/abs/2107.03374v1"
  title: string;
  summary: string;
  authors: { name: string }[];
  published: string; // ISO datetime
  updated: string;
  categories: string[];
  primaryCategory?: string;
  doi?: string;
  links: { href: string; rel: string; type?: string; title?: string }[];
}

export interface ArxivSearchParams {
  searchQuery: string;
  start: number;
  maxResults: number;
}
