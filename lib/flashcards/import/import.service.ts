/**
 * lib/flashcards/import/import.service.ts
 *
 * New module — no import capability existed anywhere in the codebase
 * (confirmed: grepped for "import" across lib/flashcards, found nothing;
 * only export/formatters.ts existed). Parses the three plain-text formats
 * that round-trip with export/formatters.ts's own output (csv, anki, json)
 * back into drafts, validates each through the same
 * validationService/draftFlashcardSchema every AI-generated card already
 * goes through, and persists via flashcardsService.createCards — so an
 * imported deck is indistinguishable from a generated one to every other
 * part of the module (review, analytics, search all just work).
 */

import { flashcardsService } from "../services/flashcards.service";
import { CARD_TYPES, type CardType, type DraftFlashcard } from "../models/flashcard.model";
import type { FlashcardDeck } from "../models/deck.model";
import { draftFlashcardSchema } from "../validation/schemas";
import { AIValidationError } from "@/lib/ai/utils/errors";

export type ImportFormat = "csv" | "anki" | "json";

export interface ImportResult {
  deck: FlashcardDeck;
  importedCount: number;
  skippedCount: number;
  skippedReasons: string[];
}

function isValidCardType(value: string): value is CardType {
  return (CARD_TYPES as readonly string[]).includes(value);
}

/** Splits on commas not inside quotes, then strips surrounding quotes / unescapes doubled quotes — inverse of formatters.ts#csvEscape. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function draftFromCsvRow(row: string[], skipped: string[]): DraftFlashcard | null {
  const [front, back, cardType, difficulty, tags, hint] = row;
  if (!front?.trim() || !back?.trim()) {
    skipped.push(`Row missing front/back: ${row.join(",").slice(0, 80)}`);
    return null;
  }

  const resolvedType = cardType && isValidCardType(cardType) ? cardType : "qa";
  const resolvedDifficulty = clampDifficulty(Number(difficulty));

  return {
    cardType: resolvedType,
    front: front.trim(),
    back: back.trim(),
    tags: tags ? tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
    hint: hint?.trim() || null,
    mnemonic: null,
    explanation: null,
    difficulty: resolvedDifficulty,
    confidence: 1, // user-imported, not AI-scored
    sourceExcerpt: null,
    imageUrl: null,
    metadata: { importedVia: "csv" },
  };
}

function parseCsv(content: string): { drafts: DraftFlashcard[]; skipped: string[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { drafts: [], skipped: [] };

  // Skip a header row if it looks like formatters.ts#toCsv's own header.
  const startIndex = /^front,back,card_type/i.test(lines[0] ?? "") ? 1 : 0;
  const skipped: string[] = [];
  const drafts: DraftFlashcard[] = [];

  for (const line of lines.slice(startIndex)) {
    const draft = draftFromCsvRow(parseCsvLine(line), skipped);
    if (draft) drafts.push(draft);
  }

  return { drafts, skipped };
}

function parseAnki(content: string): { drafts: DraftFlashcard[]; skipped: string[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.startsWith("#"));
  const skipped: string[] = [];
  const drafts: DraftFlashcard[] = [];

  for (const line of lines) {
    const [front, back, tags] = line.split("\t");
    if (!front?.trim() || !back?.trim()) {
      skipped.push(`Row missing front/back: ${line.slice(0, 80)}`);
      continue;
    }
    drafts.push({
      cardType: "qa",
      front: front.replace(/<br>/g, "\n").trim(),
      back: back.replace(/<br>/g, "\n").trim(),
      tags: tags ? tags.split(/\s+/).filter(Boolean) : [],
      hint: null,
      mnemonic: null,
      explanation: null,
      difficulty: 3,
      confidence: 1,
      sourceExcerpt: null,
      imageUrl: null,
      metadata: { importedVia: "anki" },
    });
  }

  return { drafts, skipped };
}

function parseJson(content: string): { drafts: DraftFlashcard[]; skipped: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AIValidationError("Import file is not valid JSON.");
  }

  const cardsArray = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { cards?: unknown })?.cards)
      ? (parsed as { cards: unknown[] }).cards
      : null;

  if (!cardsArray) {
    throw new AIValidationError('Import JSON must be an array of cards, or an object with a "cards" array (matching export/formatters.ts#toJson\'s shape).');
  }

  const skipped: string[] = [];
  const drafts: DraftFlashcard[] = [];

  for (const [i, raw] of cardsArray.entries()) {
    const candidate = raw as Record<string, unknown>;
    const result = draftFlashcardSchema.safeParse({
      cardType: candidate.cardType ?? "qa",
      front: candidate.front,
      back: candidate.back,
      tags: candidate.tags ?? [],
      hint: candidate.hint ?? null,
      mnemonic: candidate.mnemonic ?? null,
      explanation: candidate.explanation ?? null,
      difficulty: candidate.difficulty ?? 3,
      confidence: 1,
      sourceExcerpt: null,
      imageUrl: candidate.imageUrl ?? null,
      metadata: { importedVia: "json" },
    });

    if (!result.success) {
      skipped.push(`Card ${i}: ${result.error.issues.map((iss) => iss.message).join("; ")}`);
      continue;
    }
    drafts.push(result.data as DraftFlashcard);
  }

  return { drafts, skipped };
}

function clampDifficulty(n: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(n);
  if (Number.isNaN(rounded)) return 3;
  return Math.max(1, Math.min(5, rounded)) as 1 | 2 | 3 | 4 | 5;
}

export const importService = {
  /** Imports cards into an EXISTING deck (create the deck first via flashcardsService.createDeck / the generate endpoint with 0 target cards, or POST /api/flashcards/decks with a manual title). */
  async importCards(deckId: string, format: ImportFormat, content: string): Promise<ImportResult> {
    const deck = await flashcardsService.getDeck(deckId);
    if (!deck) throw new AIValidationError("Deck not found.", { deckId });

    const parser = format === "csv" ? parseCsv : format === "anki" ? parseAnki : parseJson;
    const { drafts, skipped } = parser(content);

    if (drafts.length === 0) {
      throw new AIValidationError("No valid cards found in the import file.", { skipped });
    }

    const validated = drafts.map((d) => draftFlashcardSchema.parse(d)) as DraftFlashcard[];
    const created = await flashcardsService.createCards(deckId, validated);
    await flashcardsService.updateCardCount(deckId, deck.cardCount + created.length);

    return {
      deck: { ...deck, cardCount: deck.cardCount + created.length },
      importedCount: created.length,
      skippedCount: skipped.length,
      skippedReasons: skipped,
    };
  },
};
