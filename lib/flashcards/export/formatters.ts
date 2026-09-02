/**
 * lib/flashcards/export/formatters.ts
 *
 * Pure, dependency-free formatters. PDF/DOCX generation reuse existing
 * document-builder utilities per "Reuse parsers"/"Reuse existing modules" —
 * see export.service.ts for the wiring note on those two formats
 * specifically; everything else here is self-contained.
 */

import type { Flashcard } from "../models/flashcard.model";
import type { FlashcardDeck } from "../models/deck.model";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toMarkdown(deck: FlashcardDeck, cards: Flashcard[]): string {
  const lines = [`# ${deck.title}`, "", `_${cards.length} cards · ${deck.learningMode} mode_`, ""];

  for (const [i, card] of cards.entries()) {
    lines.push(`## ${i + 1}. ${card.front}`);
    lines.push("");
    lines.push(card.back);
    if (card.hint) lines.push(`\n> **Hint:** ${card.hint}`);
    if (card.mnemonic) lines.push(`\n> **Mnemonic:** ${card.mnemonic}`);
    if (card.tags.length > 0) lines.push(`\n\`${card.tags.join("`, `")}\``);
    lines.push("");
  }

  return lines.join("\n");
}

export function toJson(deck: FlashcardDeck, cards: Flashcard[]): string {
  return JSON.stringify(
    {
      deck: { id: deck.id, title: deck.title, learningMode: deck.learningMode, cardCount: cards.length },
      cards: cards.map((c) => ({
        id: c.id,
        cardType: c.cardType,
        front: c.front,
        back: c.back,
        tags: c.tags,
        hint: c.hint,
        mnemonic: c.mnemonic,
        explanation: c.explanation,
        difficulty: c.difficulty,
      })),
    },
    null,
    2
  );
}

export function toCsv(cards: Flashcard[]): string {
  const header = ["front", "back", "card_type", "difficulty", "tags", "hint"].join(",");
  const rows = cards.map((c) =>
    [
      csvEscape(c.front),
      csvEscape(c.back),
      csvEscape(c.cardType),
      String(c.difficulty),
      csvEscape(c.tags.join("|")),
      csvEscape(c.hint ?? ""),
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function toTxt(cards: Flashcard[]): string {
  return cards.map((c) => `Q: ${c.front}\nA: ${c.back}`).join("\n\n");
}

export function toHtml(deck: FlashcardDeck, cards: Flashcard[]): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cardHtml = cards
    .map(
      (c, i) => `
    <section class="card">
      <h3>${i + 1}. ${escape(c.front)}</h3>
      <p>${escape(c.back)}</p>
      ${c.hint ? `<p class="hint">Hint: ${escape(c.hint)}</p>` : ""}
      ${c.tags.length ? `<p class="tags">${c.tags.map(escape).join(", ")}</p>` : ""}
    </section>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(deck.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  .card { border-bottom: 1px solid #ddd; padding: 1rem 0; }
  .hint { color: #666; font-style: italic; }
  .tags { color: #888; font-size: 0.85rem; }
</style>
</head>
<body>
  <h1>${escape(deck.title)}</h1>
  <p>${cards.length} cards · ${escape(deck.learningMode)} mode</p>
  ${cardHtml}
</body>
</html>`;
}

/**
 * Anki-compatible export: tab-separated front/back/tags, matching the
 * format Anki's "Import File" (Basic note type) expects directly — no
 * .apkg packaging (that needs SQLite + zip, out of scope for a text export).
 */
export function toAnki(cards: Flashcard[]): string {
  const header = "#separator:tab\n#html:true\n#tags column:3\n";
  const rows = cards.map((c) => {
    const front = c.front.replace(/\t/g, " ").replace(/\n/g, "<br>");
    const back = c.back.replace(/\t/g, " ").replace(/\n/g, "<br>");
    const tags = c.tags.join(" ");
    return `${front}\t${back}\t${tags}`;
  });
  return header + rows.join("\n");
}
