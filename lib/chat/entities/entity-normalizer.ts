/**
 * lib/chat/entities/entity-normalizer.ts
 *
 * intent-detection.prompt.ts extracts entities as free-form key/value pairs
 * (necessarily loose, since the entity set varies per module). This module
 * normalizes the common ones every module adapter is likely to read, so
 * router/module-registry.ts adapters don't each re-implement "is this a
 * date-ish string" parsing.
 */

import type { ExtractedEntities } from "../types/chat.types";

const KNOWN_DEADLINE_WORDS: Record<string, number> = {
  today: 0,
  tonight: 0,
  tomorrow: 1,
};

/** Resolves loose deadline language ("tomorrow", "in 3 days") to an ISO date, where confidently parseable. Returns null rather than guessing. */
export function normalizeDeadline(raw: string | undefined, now: Date = new Date()): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();

  if (lower in KNOWN_DEADLINE_WORDS) {
    const d = new Date(now);
    d.setDate(d.getDate() + KNOWN_DEADLINE_WORDS[lower]!);
    return d.toISOString().slice(0, 10);
  }

  const inDaysMatch = lower.match(/^in (\d+) days?$/);
  if (inDaysMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + Number(inDaysMatch[1]));
    return d.toISOString().slice(0, 10);
  }

  const isoMatch = lower.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) return lower;

  return null; // ambiguous ("next week", "soon") — let the module adapter or a clarifying question handle it
}

/** Returns the first present value for any of the given entity keys — handles the model choosing a slightly different key name than expected. */
export function pickEntity(entities: ExtractedEntities, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = entities[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

export function pickEntityList(entities: ExtractedEntities, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = entities[key];
    if (Array.isArray(value) && value.length > 0) return value;
    if (typeof value === "string" && value.trim().length > 0) return [value.trim()];
  }
  return [];
}

/** Common entity accessors every module adapter can reach for instead of guessing the model's exact key naming. */
export function commonEntities(entities: ExtractedEntities) {
  return {
    subject: pickEntity(entities, "subject", "topic", "course"),
    deadline: normalizeDeadline(pickEntity(entities, "deadline", "due_date", "dueDate")),
    role: pickEntity(entities, "role", "job_role", "position"),
    seniority: pickEntity(entities, "seniority", "experience_level"),
    company: pickEntity(entities, "company"),
    difficulty: pickEntity(entities, "difficulty", "difficulty_level"),
    documentReference: pickEntity(entities, "document", "document_reference", "upload"),
  };
}
