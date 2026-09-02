# Research AI Backend — Module 1: Paper Search Foundation

## What's in this module

```
lib/research/
  models/
    paper.types.ts        Canonical Paper / PaperSearchQuery / AggregatedSearchResult types
  utils/
    errors.ts              ResearchError hierarchy (Provider/Timeout/RateLimit/Validation/AllProvidersFailed)
    retry.ts                withRetry() — exponential backoff + jitter, only retries transient failures
    logger.ts               researchLogger — structured JSON logging, swap sink here later
  validation/
    search-query.validation.ts   validatePaperSearchQuery() — no zod dependency required
  providers/
    provider.interface.ts   PaperSearchProvider contract every source implements
    provider.registry.ts    Central wiring — add new providers here only
    arxiv/
      arxiv.types.ts        Raw arXiv Atom-feed shapes (internal only)
      arxiv.parser.ts        Atom XML -> ArxivRawEntry[] (uses fast-xml-parser)
      arxiv.provider.ts       Implements PaperSearchProvider for arxiv.org
  services/
    paper-search.service.ts   searchPapers() — the one function API routes call
```

## What it does

`searchPapers({ kind: 'keyword', query: 'graph neural networks' })`:

1. Validates the query (throws `ResearchValidationError` with a list of issues on bad input).
2. Filters the provider registry down to providers whose `supports(kind)` returns true.
3. Runs all matching providers concurrently via `Promise.allSettled` — one provider failing
   never sinks the whole search.
4. Deduplicates the merged results by DOI → arXiv id → PMID → normalized title, merging
   metadata from duplicate records (keeps the richer abstract, fills in missing identifiers).
5. Returns `{ query, papers, perSource, tookMs }` — `perSource` keeps each provider's raw
   (already-normalized) result set for transparency/debugging without polluting the merged list.

Currently registered providers: **arXiv** (keyword / topic / author search, no key required).

## What's NOT in this module (by design)

- CrossRef, Semantic Scholar, OpenAlex, PubMed providers — next modules, same interface.
- Paper analysis, literature review, citation engine, comparison, research-gap engine,
  OCR, vector search, trend analysis, exports — all separate modules per the spec.
- Any Gemini/AI call — this module is pure data-fetching and normalization. Analysis
  features will call this service for the source papers, then go through
  `lib/ai/engine.ts` exactly like every other feature, per your "never call Gemini
  directly" rule.
- Frontend, auth, DB schema, AI Core — untouched, as instructed.

## Dependency to install

```bash
npm install fast-xml-parser
```

Used only inside `providers/arxiv/arxiv.parser.ts` to parse arXiv's Atom XML feed.

## Suggested API route wiring (not included — you said no frontend/route changes yet)

```ts
// app/api/research/search/route.ts (when you're ready to wire it up)
import { searchPapers } from '@/lib/research/services/paper-search.service';

export async function POST(req: Request) {
  const body = await req.json();
  const result = await searchPapers(body);
  return Response.json(result);
}
```

## Next module (waiting on your confirmation)

Recommended order, since everything else in the spec reads from paper search results:

1. **CrossRef + OpenAlex providers** (DOI search, institution/journal/conference facets —
   things arXiv can't do) — fills the gap in provider coverage.
2. **Semantic Scholar + PubMed providers** — citation metrics, influential-citation data,
   biomedical coverage.
3. Then **Paper Analysis** (Summary/ELI5/Novelty/Gap/etc.) or **Citation Engine**, since
   both only need one working provider to be useful, which you now have.

Say the word and I'll build the next one — same standard (typed, modular, no placeholders,
error handling + retry + logging on everything).
