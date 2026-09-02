/**
 * lib/document/utils/markdown-formatter.ts
 * Small formatting helpers shared by export/formatters.ts and anything
 * that needs to render Section/TableBlock data as markdown outside a full
 * document export (e.g. a single-section preview in the UI).
 */

import type { TableBlock } from "../models/content-block.model";
import type { Section } from "../models/section.model";

export function tableToMarkdown(table: TableBlock): string {
  const lines = [`| ${table.headers.join(" | ")} |`, `| ${table.headers.map(() => "---").join(" | ")} |`];
  for (const row of table.rows) lines.push(`| ${row.join(" | ")} |`);
  return lines.join("\n");
}

export function sectionToMarkdown(section: Section): string {
  const lines: string[] = [];
  if (section.heading) lines.push(`${"#".repeat(section.heading.level)} ${section.heading.text}`, "");
  for (const block of section.blocks) {
    if (block.type === "paragraph") {
      lines.push(block.data.isQuote ? `> ${block.data.text}` : block.data.text, "");
    } else {
      block.data.items.forEach((item, i) => lines.push(block.data.ordered ? `${i + 1}. ${item}` : `- ${item}`));
      lines.push("");
    }
  }
  return lines.join("\n");
}
