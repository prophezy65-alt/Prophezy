// lib/assignment/utils/keyword-extractor.ts
// Dependency-free keyword extraction using term-frequency scoring with a
// stopword filter and n-gram (up to trigram) candidate generation. Used as a
// deterministic cross-check against AI-suggested keywords, and as a fallback
// keyword source for duplicate-content detection when AI output is
// unavailable (e.g. rate-limited).

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "for", "to", "of", "in",
  "on", "at", "by", "with", "as", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "from", "which", "what", "how", "why",
  "you", "your", "we", "our", "i", "they", "their", "he", "she", "his", "her", "them",
  "explain", "describe", "discuss", "write", "give", "find", "calculate", "show",
  "state", "define", "list", "using", "use", "each", "any", "all", "also", "into",
  "can", "will", "shall", "should", "would", "must", "may", "might", "not", "no",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

export function extractKeywords(text: string, maxKeywords = 8): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  const frequency = new Map<string, number>();

  // Unigrams
  for (const token of tokens) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }

  // Bigrams — often more meaningful than single words in academic text
  // (e.g. "binary search", "chemical bond", "supply chain")
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    frequency.set(bigram, (frequency.get(bigram) ?? 0) + 1.5); // slight boost for multi-word phrases
  }

  const ranked = Array.from(frequency.entries())
    .filter(([term, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1]);

  const selected: string[] = [];
  const seenWords = new Set<string>();

  for (const [term] of ranked) {
    const words = term.split(" ");
    // Skip a unigram that's already covered inside a chosen bigram
    if (words.length === 1 && selected.some((s) => s.includes(term))) continue;
    if (words.some((w) => seenWords.has(w)) && words.length === 1) continue;

    selected.push(term);
    words.forEach((w) => seenWords.add(w));

    if (selected.length >= maxKeywords) break;
  }

  return selected;
}

/** Jaccard similarity over keyword sets — used by the duplicate-content
 * detector as a fast pre-filter before running a more expensive embedding
 * comparison via pgvector. */
export function keywordJaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
