/**
 * lib/syllabus/ingestion/text.extractor.ts
 *
 * Plain-text syllabus input needs no parsing library — just
 * normalization so downstream extraction sees consistent line
 * breaks and whitespace regardless of how the client sent it.
 */

export function normalizePlainText(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ') // non-breaking spaces from copy-pasted PDFs
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
