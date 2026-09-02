/**
 * lib/flashcards/generator/concept-extractor.ts
 *
 * The AI Core Engine already extracts concepts/topics/keywords as part of
 * `GenerationResponse.concepts` (see prompts/flashcards.prompts.ts). This
 * module is the deterministic, non-AI pass that runs *before* generation:
 * a cheap local keyword/date/name extractor used to (a) enrich the prompt
 * with candidate terms so the model doesn't miss obvious ones, and (b)
 * cross-check the model's concept list isn't empty/degenerate.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "is",
  "are", "was", "were", "be", "been", "with", "as", "by", "at", "this",
  "that", "it", "its", "from", "into", "such", "than", "then", "so", "we",
  "you", "your", "our", "their", "his", "her", "they", "he", "she",
]);

const DATE_PATTERN = /\b(?:\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/g;
const NAME_PATTERN = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b/g;
const EQUATION_PATTERN = /([A-Za-z0-9_]+\s*=\s*[^.\n]{2,80})/g;

export interface LocalExtractionResult {
  candidateKeywords: string[];
  dates: string[];
  properNouns: string[];
  equations: string[];
}

export function extractLocalCandidates(text: string, limit = 40): LocalExtractionResult {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

  const candidateKeywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);

  const dates = Array.from(new Set(text.match(DATE_PATTERN) ?? []));
  const properNouns = Array.from(new Set(text.match(NAME_PATTERN) ?? [])).slice(0, limit);
  const equations = Array.from(new Set(text.match(EQUATION_PATTERN) ?? [])).slice(0, limit);

  return { candidateKeywords, dates, properNouns, equations };
}

export interface MergedConcept {
  name: string;
  kind: "concept" | "topic" | "keyword" | "formula" | "date" | "name";
  weight: number;
}

/**
 * Merges AI-extracted concepts with local heuristic finds the model may
 * have missed (dates, equations, proper nouns), de-duplicated case-insensitively.
 */
export function mergeConcepts(
  aiConcepts: { name: string; kind: string; weight?: number }[],
  local: LocalExtractionResult
): MergedConcept[] {
  const seen = new Map<string, MergedConcept>();

  for (const c of aiConcepts) {
    const key = c.name.trim().toLowerCase();
    if (!key) continue;
    seen.set(key, {
      name: c.name.trim(),
      kind: (c.kind as MergedConcept["kind"]) ?? "concept",
      weight: c.weight ?? 1,
    });
  }

  for (const date of local.dates) {
    const key = date.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: date, kind: "date", weight: 0.6 });
  }

  for (const eq of local.equations) {
    const key = eq.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: eq.trim(), kind: "formula", weight: 0.7 });
  }

  for (const noun of local.properNouns.slice(0, 15)) {
    const key = noun.toLowerCase();
    if (!seen.has(key)) seen.set(key, { name: noun, kind: "name", weight: 0.4 });
  }

  return Array.from(seen.values()).sort((a, b) => b.weight - a.weight);
}
