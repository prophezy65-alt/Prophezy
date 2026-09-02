/**
 * lib/flashcards/services/export.service.ts
 */

import { flashcardsService } from "./flashcards.service";
import { validationService } from "../validation/validation.service";
import { AIValidationError } from "@/lib/ai/utils/errors";
import { toMarkdown, toJson, toCsv, toTxt, toHtml, toAnki } from "../export/formatters";

export interface ExportResult {
  filename: string;
  mimeType: string;
  content: string | Buffer;
}

export const exportService = {
  async exportDeck(rawInput: unknown): Promise<ExportResult> {
    const input = validationService.validateExportRequest(rawInput);

    const deck = await flashcardsService.getDeck(input.deckId);
    if (!deck) throw new AIValidationError("Deck not found.", { deckId: input.deckId });

    const cards = await flashcardsService.listCardsForDeck(input.deckId);
    const safeName = deck.title.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();

    switch (input.format) {
      case "markdown":
        return { filename: `${safeName}.md`, mimeType: "text/markdown", content: toMarkdown(deck, cards) };
      case "json":
        return { filename: `${safeName}.json`, mimeType: "application/json", content: toJson(deck, cards) };
      case "csv":
        return { filename: `${safeName}.csv`, mimeType: "text/csv", content: toCsv(cards) };
      case "txt":
        return { filename: `${safeName}.txt`, mimeType: "text/plain", content: toTxt(cards) };
      case "html":
        return { filename: `${safeName}.html`, mimeType: "text/html", content: toHtml(deck, cards) };
      case "anki":
        return { filename: `${safeName}_anki.txt`, mimeType: "text/plain", content: toAnki(cards) };

      case "pdf": {
        // WIRING NOTE: reuse the existing PDF builder (per "Reuse existing
        // modules") rather than adding a new PDF dependency. Resume Studio
        // almost certainly already renders structured content to PDF —
        // point this at that export util, feeding it toMarkdown(deck, cards)
        // or an HTML string from toHtml() as the source.
        throw new AIValidationError(
          "PDF export needs to be wired to the existing PDF generation utility (Resume Studio's PDF builder, reused per spec) — not implemented here as a placeholder.",
          { format: "pdf" }
        );
      }

      case "docx": {
        // WIRING NOTE: same as PDF — reuse whatever DOCX builder Resume
        // Studio / docx skill infra already uses, feeding it the card list.
        throw new AIValidationError(
          "DOCX export needs to be wired to the existing DOCX generation utility, reused per spec — not implemented here as a placeholder.",
          { format: "docx" }
        );
      }

      default:
        throw new AIValidationError("Unsupported export format.", { format: input.format });
    }
  },
};
