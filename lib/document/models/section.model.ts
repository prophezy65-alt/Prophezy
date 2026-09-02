/**
 * lib/document/models/section.model.ts
 * Sections form the document's logical outline (heading tree). Paragraphs
 * and Lists live inside a Section's `blocks`.
 */

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  pageIndex: number;
}

export interface Paragraph {
  text: string;
  pageIndex: number;
  isQuote: boolean;
}

export interface ListBlock {
  ordered: boolean;
  items: string[];
  pageIndex: number;
}

export type SectionBlock =
  | { type: "paragraph"; data: Paragraph }
  | { type: "list"; data: ListBlock };

export interface Section {
  id: string;
  heading: Heading | null;
  blocks: SectionBlock[];
  startPageIndex: number;
  endPageIndex: number;
  order: number;
}

export interface TocEntry {
  title: string;
  level: number;
  pageNumber: number;
}

export interface Reference {
  raw: string;
  authors: string[] | null;
  year: number | null;
  title: string | null;
  url: string | null;
}

export interface Footnote {
  marker: string;
  text: string;
  pageIndex: number;
}
