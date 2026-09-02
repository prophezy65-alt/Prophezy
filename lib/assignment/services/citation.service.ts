// lib/assignment/services/citation.service.ts
// Deterministic citation string formatting. Takes structured reference
// fields (already produced by the AI in generator.service.ts) and formats
// them consistently — formatting itself does not need AI and should be
// exact/reproducible, which is why this stays rule-based.

export type CitationStyle = "apa" | "ieee";

export interface CitationInput {
  type: "book" | "paper" | "website" | "standard";
  title: string;
  authors: string[];
  year: number | null;
  publisher: string | null;
  url: string | null;
}

export function formatCitation(input: CitationInput, style: CitationStyle = "apa"): string {
  return style === "ieee" ? formatIeee(input) : formatApa(input);
}

function formatApa(input: CitationInput): string {
  const authorPart = formatAuthorsApa(input.authors);
  const yearPart = input.year ? `(${input.year}).` : "(n.d.).";
  const titlePart = input.type === "paper" ? `${input.title}.` : `*${input.title}*.`;
  const publisherPart = input.publisher ? `${input.publisher}.` : "";
  const urlPart = input.url ? input.url : "";

  return [authorPart, yearPart, titlePart, publisherPart, urlPart].filter(Boolean).join(" ").trim();
}

function formatIeee(input: CitationInput): string {
  const authorPart = input.authors.length > 0 ? input.authors.join(", ") + "," : "";
  const titlePart = `"${input.title},"`;
  const publisherPart = input.publisher ? `${input.publisher},` : "";
  const yearPart = input.year ? `${input.year}.` : "n.d.";
  const urlPart = input.url ? `Available: ${input.url}` : "";

  return [authorPart, titlePart, publisherPart, yearPart, urlPart].filter(Boolean).join(" ").trim();
}

function formatAuthorsApa(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return `${authors[0]}.`;
  if (authors.length <= 6) {
    return `${authors.slice(0, -1).join(", ")}, & ${authors[authors.length - 1]}.`;
  }
  return `${authors.slice(0, 6).join(", ")}, et al.`;
}

/** Basic structural validation for a citation — catches the most common
 * "hallucinated reference" red flags (no title, no year AND no url, etc.)
 * so validator.service.ts can flag low-confidence references to the student
 * rather than presenting them as verified sources. */
export function assessCitationQuality(input: CitationInput): { isLikelyReliable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!input.title || input.title.trim().length < 3) reasons.push("Missing or very short title");
  if (input.authors.length === 0) reasons.push("No authors listed");
  if (!input.year && !input.url) reasons.push("No year or URL to verify recency/source");
  if (input.type === "website" && !input.url) reasons.push("Website reference has no URL");

  return { isLikelyReliable: reasons.length === 0, reasons };
}
