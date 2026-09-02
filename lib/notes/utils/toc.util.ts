/**
 * lib/notes/utils/toc.util.ts
 * Automatic table-of-contents + heading generation from NotesOutput topics.
 */
import type { NotesOutput } from "../models/types";

export interface TocEntry {
  title: string;
  level: 1 | 2;
  anchor: string;
}

function anchorize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Builds a flat TOC (topics as level 1, subtopics as level 2) with markdown-heading-compatible anchors. */
export function buildTableOfContents(notes: NotesOutput): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const topic of notes.topics) {
    entries.push({ title: topic.title, level: 1, anchor: anchorize(topic.title) });
    for (const sub of topic.subtopics ?? []) {
      entries.push({ title: sub.title, level: 2, anchor: anchorize(sub.title) });
    }
  }
  return entries;
}

/** Renders a TOC as a markdown bullet list with anchor links, for prepending to an export. */
export function renderTocMarkdown(toc: TocEntry[]): string {
  return toc
    .map((entry) => `${entry.level === 2 ? "  " : ""}- [${entry.title}](#${entry.anchor})`)
    .join("\n");
}
