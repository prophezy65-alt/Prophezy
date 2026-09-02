import { createHash } from 'node:crypto';

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','he','in','is','it','its','of','on',
  'that','the','to','was','were','will','with','you','your','our','we','this','these','those','or',
  'intern','internship','role','job','position','opportunity','program','programme',
]);

export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function slugify(input: string): string {
  return collapseWhitespace(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** Lowercased, punctuation-free, stopword-free token list. */
export function tokenize(input: string): string[] {
  return collapseWhitespace(input.toLowerCase())
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function normalizeTitle(title: string): string {
  return collapseWhitespace(
    title
      .toLowerCase()
      .replace(/\((remote|hybrid|onsite|on-site|paid|unpaid|wfh)\)/g, ' ')
      .replace(/[–—-]\s*(remote|hybrid|onsite|india|usa|uk).*$/i, ' ')
      .replace(/\b(20\d{2}|summer|winter|spring|fall|autumn)\b/g, ' ')
      .replace(/[^a-z0-9\s+#]/g, ' '),
  );
}

/** Character-level trigram Jaccard — cheap, no model call, good for near-duplicate titles. */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string): Set<string> => {
    const padded = `  ${s}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const g of A) if (B.has(g)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a.map((s) => s.toLowerCase()));
  const B = new Set(b.map((s) => s.toLowerCase()));
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const v of A) if (B.has(v)) intersection += 1;
  return intersection / (A.size + B.size - intersection);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    const x = a[i] as number;
    const y = b[i] as number;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Role-title inflections that denote the same job. A general suffix stemmer was
 * tried first and over-stemmed ("engineer" -> "engine", "director" -> "direct"),
 * so this is an explicit, auditable equivalence map instead. Anything not listed
 * only gets a conservative plural rule.
 */
const TITLE_EQUIVALENTS: Readonly<Record<string, string>> = {
  engineering: 'engineer',
  engineer: 'engineer',
  developing: 'developer',
  developer: 'developer',
  development: 'developer',
  dev: 'developer',
  analytics: 'analyst',
  analytical: 'analyst',
  analysis: 'analyst',
  analyst: 'analyst',
  scientist: 'science',
  science: 'science',
  designer: 'design',
  designing: 'design',
  design: 'design',
  researcher: 'research',
  research: 'research',
  marketing: 'marketing',
  marketer: 'marketing',
  programming: 'programmer',
  programmer: 'programmer',
  administration: 'admin',
  administrator: 'admin',
  admin: 'admin',
  intern: 'intern',
  internship: 'intern',
  interns: 'intern',
  trainee: 'intern',
  apprentice: 'intern',
};

export function stemToken(token: string): string {
  const t = token.toLowerCase();
  const mapped = TITLE_EQUIVALENTS[t];
  if (mapped) return mapped;
  // Conservative plural rule: never applied to short tokens or -ss endings.
  if (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) {
    return t.slice(0, -1);
  }
  return t;
}

/** Jaccard over stemmed, order-insensitive title tokens. */
export function titleTokenSimilarity(a: string, b: string): number {
  const setA = [...new Set(tokenize(a).map(stemToken))];
  const setB = [...new Set(tokenize(b).map(stemToken))];
  return jaccard(setA, setB);
}
