/**
 * lib/research/providers/provider.registry.ts
 *
 * Single place that knows about concrete provider implementations.
 * Adding CrossRef/Semantic Scholar/OpenAlex/PubMed later means
 * writing providers/<name>/<name>.provider.ts and adding one line
 * here — paper-search.service.ts itself never changes.
 *
 * SyncedArxivProvider added for the Background Research Paper Automation
 * Agent: it reads papers GitHub Actions has already synced into
 * `research_synced_papers` (see db-synced/db-synced.provider.ts and
 * scripts/sync-research-papers.ts) so they show up in the existing Search
 * Papers tab alongside live arXiv results, deduped automatically.
 */
import type { PaperSearchProvider } from './provider.interface';
import { ArxivProvider } from './arxiv/arxiv.provider';
import { SyncedArxivProvider } from './db-synced/db-synced.provider';

const registry: PaperSearchProvider[] = [new ArxivProvider(), new SyncedArxivProvider()];

export function getAllProviders(): PaperSearchProvider[] {
  return registry;
}

export function getProviders(sources?: string[]): PaperSearchProvider[] {
  if (!sources || sources.length === 0) return registry;
  return registry.filter((p) => sources.includes(p.source));
}
