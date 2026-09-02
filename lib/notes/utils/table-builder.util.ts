/**
 * lib/notes/utils/table-builder.util.ts
 * Renders a NotesOutput generated with noteType "comparison_table" as an
 * actual markdown table, using each topic as a column and each subtopic
 * title as a row label (comparison-table-notes.prompt.ts instructs the
 * model to keep subtopic titles parallel across topics for exactly this).
 */
import type { NotesOutput } from "../models/types";

export function buildComparisonTableMarkdown(notes: NotesOutput): string {
  if (notes.topics.length === 0) return "";

  const rowLabels = Array.from(
    new Set(notes.topics.flatMap((t) => (t.subtopics ?? []).map((s) => s.title)))
  );

  const header = `| Dimension | ${notes.topics.map((t) => t.title).join(" | ")} |`;
  const separator = `| --- | ${notes.topics.map(() => "---").join(" | ")} |`;

  const rows = rowLabels.map((label) => {
    const cells = notes.topics.map((topic) => {
      const match = (topic.subtopics ?? []).find((s) => s.title === label);
      return (match?.summary ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    });
    return `| ${label} | ${cells.join(" | ")} |`;
  });

  return [header, separator, ...rows].join("\n");
}
