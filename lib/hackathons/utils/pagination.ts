/**
 * pagination.ts
 * Cursor-based pagination helpers used by search.service.ts and
 * hackathon.service.ts list endpoints. Cursors are opaque base64-encoded
 * offsets — simple and sufficient for an in-app list; swap for a real
 * keyset cursor (e.g. encoding the last row's sort key) once backed by
 * actual DB queries.
 */

import { CursorPage } from "../models/hackathon.model";

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf-8").toString("base64");
}

export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const offset = parseInt(decoded, 10);
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

export function paginate<T>(items: T[], cursor: string | undefined, limit: number): CursorPage<T> {
  const offset = decodeCursor(cursor);
  const page = items.slice(offset, offset + limit);
  const hasMore = offset + limit < items.length;

  return {
    items: page,
    nextCursor: hasMore ? encodeCursor(offset + limit) : null,
    hasMore,
  };
}
