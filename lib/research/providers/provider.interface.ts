/**
 * lib/research/providers/provider.interface.ts
 *
 * Every paper-search source (arXiv, CrossRef, Semantic Scholar,
 * OpenAlex, PubMed) implements this contract. The paper-search
 * service depends only on this interface (dependency inversion) —
 * it never imports a concrete provider directly except in the
 * registry wiring, so adding a new source never requires touching
 * the service.
 */

import type {
  PaperSearchQuery,
  PaperSource,
  ProviderSearchResult,
} from '../models/paper.types';

export interface PaperSearchProvider {
  readonly source: PaperSource;

  /**
   * Whether this provider can service the given query kind at all
   * (e.g. PubMed doesn't support arbitrary DOI lookups the same way
   * CrossRef does). The service uses this to skip providers up
   * front instead of dispatching a call that's guaranteed to fail.
   */
  supports(kind: PaperSearchQuery['kind']): boolean;

  /**
   * Execute the search against the live source and return normalized
   * Paper records. Implementations are responsible for:
   *  - building the provider-specific request
   *  - handling that provider's pagination/rate-limit conventions
   *  - normalizing the raw response into `Paper[]`
   *  - throwing ProviderRequestError / ProviderTimeoutError /
   *    ProviderRateLimitError (from utils/errors.ts) on failure —
   *    never swallowing errors silently.
   */
  search(query: PaperSearchQuery): Promise<ProviderSearchResult>;
}
