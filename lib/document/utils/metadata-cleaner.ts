/**
 * lib/document/utils/metadata-cleaner.ts
 * Normalizes messy metadata pulled from PDF/DOCX properties: trims,
 * collapses whitespace, strips control characters, de-duplicates author
 * lists, and drops obviously-placeholder values some editors leave behind
 * (e.g. "Microsoft Word", "Untitled document", empty strings).
 */

const PLACEHOLDER_TITLES = new Set([
  "untitled document", "untitled", "document1", "microsoft word - document1",
]);

export function cleanTitle(title: string | null): string | null {
  if (!title) return null;
  const cleaned = title.trim().replace(/\s+/g, " ").replace(/[\x00-\x1F\x7F]/g, "");
  if (!cleaned || PLACEHOLDER_TITLES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

export function cleanAuthors(authors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of authors) {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

export function cleanDateString(raw: string | null): string | null {
  if (!raw) return null;
  const pdfDateMatch = raw.match(/^D:(\d{4})(\d{2})(\d{2})/);
  if (pdfDateMatch) {
    const [, y, mo, d] = pdfDateMatch;
    return `${y}-${mo}-${d}`;
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
