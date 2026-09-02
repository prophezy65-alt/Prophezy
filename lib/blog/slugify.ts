export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

// Extracts ## and ### headings directly from the raw markdown source, used
// server-side to build the table of contents without needing to parse the
// full markdown AST.
export function extractHeadings(markdown: string): Heading[] {
  const lines = markdown.split("\n");
  const headings: Heading[] = [];
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2) headings.push({ id: slugifyHeading(h2[1]!), text: h2[1]!, level: 2 });
    else if (h3) headings.push({ id: slugifyHeading(h3[1]!), text: h3[1]!, level: 3 });
  }
  return headings;
}
