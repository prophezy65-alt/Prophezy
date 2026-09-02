/**
 * lib/document/export/formatters.ts
 * Same pattern as the Flashcards Engine's export/formatters.ts — pure,
 * dependency-free formatters operating on the normalized ProphezyDocument.
 */

import type { ProphezyDocument } from "../models/document.model";

export function toJson(doc: ProphezyDocument): string {
  return JSON.stringify(
    {
      id: doc.id,
      filename: doc.filename,
      format: doc.format,
      metadata: doc.metadata,
      summary: doc.summary,
      language: doc.language,
      readingTimeMinutes: doc.readingTimeMinutes,
      topics: doc.topics,
      keywords: doc.keywords,
      sections: doc.sections,
      tables: doc.tables,
      codeBlocks: doc.codeBlocks,
      formulas: doc.formulas,
    },
    null,
    2
  );
}

export function toMarkdown(doc: ProphezyDocument): string {
  const lines = [`# ${doc.metadata.title ?? doc.filename}`, ""];

  if (doc.summary) {
    lines.push("## Summary", "", doc.summary, "");
  }

  for (const section of doc.sections) {
    if (section.heading) {
      lines.push(`${"#".repeat(Math.min(6, section.heading.level + 1))} ${section.heading.text}`, "");
    }
    for (const block of section.blocks) {
      if (block.type === "paragraph") {
        lines.push(block.data.isQuote ? `> ${block.data.text}` : block.data.text, "");
      } else {
        for (const item of block.data.items) {
          lines.push(block.data.ordered ? `1. ${item}` : `- ${item}`);
        }
        lines.push("");
      }
    }
  }

  if (doc.tables.length > 0) {
    lines.push("## Tables", "");
    for (const table of doc.tables) {
      if (table.caption) lines.push(`**${table.caption}**`, "");
      lines.push(`| ${table.headers.join(" | ")} |`);
      lines.push(`| ${table.headers.map(() => "---").join(" | ")} |`);
      for (const row of table.rows) lines.push(`| ${row.join(" | ")} |`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function toTxt(doc: ProphezyDocument): string {
  return doc.pages.map((p) => p.text).join("\n\n");
}

export function toHtml(doc: ProphezyDocument): string {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const sectionsHtml = doc.sections
    .map((s) => {
      const headingHtml = s.heading ? `<h${Math.min(6, s.heading.level + 1)}>${escape(s.heading.text)}</h${Math.min(6, s.heading.level + 1)}>` : "";
      const blocksHtml = s.blocks
        .map((b) =>
          b.type === "paragraph"
            ? `<p${b.data.isQuote ? ' class="quote"' : ""}>${escape(b.data.text)}</p>`
            : `<${b.data.ordered ? "ol" : "ul"}>${b.data.items.map((i) => `<li>${escape(i)}</li>`).join("")}</${b.data.ordered ? "ol" : "ul"}>`
        )
        .join("\n");
      return `${headingHtml}\n${blocksHtml}`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="${doc.language ?? "en"}">
<head><meta charset="utf-8" /><title>${escape(doc.metadata.title ?? doc.filename)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.6}.quote{border-left:3px solid #ccc;padding-left:1rem;color:#555}</style>
</head>
<body>
<h1>${escape(doc.metadata.title ?? doc.filename)}</h1>
${doc.summary ? `<p><em>${escape(doc.summary)}</em></p>` : ""}
${sectionsHtml}
</body>
</html>`;
}

export function toCsv(doc: ProphezyDocument): string {
  if (doc.tables.length === 0) {
    // No tabular data — export page text as a two-column (page, text) CSV instead of an empty file.
    const header = "page,text";
    const rows = doc.pages.map((p) => `${p.pageNumber},"${p.text.replace(/"/g, '""')}"`);
    return [header, ...rows].join("\n");
  }

  const table = doc.tables[0]!;
  const header = table.headers.join(",");
  const rows = table.rows.map((r) => r.map((c) => (c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c)).join(","));
  return [header, ...rows].join("\n");
}
