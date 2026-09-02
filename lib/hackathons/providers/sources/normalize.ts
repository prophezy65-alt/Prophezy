/**
 * normalize.ts
 * Shared helpers every source adapter uses to produce a well-formed
 * `Hackathon` object from whatever raw shape the source returns, and to
 * compute a stable content hash for change detection during sync jobs.
 */

import { Hackathon, HackathonSourceId } from "../../models/hackathon.model";

export function buildHackathonId(sourceId: HackathonSourceId, sourceNativeId: string): string {
  return `${sourceId}_${sourceNativeId}`;
}

/**
 * Deterministic, dependency-free string hash (FNV-1a) used to detect
 * whether a hackathon's content changed between sync runs, without
 * pulling in a crypto library for a non-security use case.
 */
export function hashContent(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function computeRawSourceHash(hackathon: Omit<Hackathon, "rawSourceHash" | "fetchedAt">): string {
  return hashContent(
    JSON.stringify({
      title: hackathon.title,
      description: hackathon.description,
      timeline: hackathon.timeline,
      prizes: hackathon.prizes,
    })
  );
}

/**
 * Best-effort mode inference from free-text location strings, since many
 * sources don't expose a clean online/offline/hybrid field.
 */
export function inferMode(locationText?: string): Hackathon["mode"] {
  if (!locationText) return "online";
  const lower = locationText.toLowerCase();
  if (lower.includes("online") || lower.includes("virtual") || lower.includes("remote")) return "online";
  if (lower.includes("hybrid")) return "hybrid";
  return "offline";
}

const LEADING_MONTH_RE = /^[A-Za-z]{3,9}\b/;

function extractYear(text: string): string | undefined {
  return text.match(/\b(20\d{2})\b/)?.[1];
}

function extractMonth(text: string): string | undefined {
  return text.match(LEADING_MONTH_RE)?.[0];
}

/**
 * Devpost's real `submission_period_dates` field (confirmed against a
 * live sample: "Nov 09 - 20, 2025") is a free-text range, not an ISO
 * date — `new Date()` on the raw string returns Invalid Date, which
 * calculateUrgency() then reads as "past", silently dropping the
 * hackathon from every default list view no matter how recently it was
 * synced. This extracts the END of that range — the actual submission
 * deadline — as a real ISO 8601 string derived entirely from Devpost's
 * own text. It never invents a date: if the source string genuinely
 * can't be parsed, the original raw text is returned unchanged so
 * downstream validation/urgency logic sees the same "unparseable" signal
 * it always did, rather than a fabricated fallback date.
 *
 * Handles the shapes Devpost actually sends:
 *   "December 5, 2026"        -> single date, parses directly
 *   "Nov 09 - 20, 2025"       -> same-month range, end lacks a month
 *   "Nov 09 - Dec 20, 2025"   -> cross-month range, end lacks a year
 */
export function parseDeadlineText(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const parts = trimmed.split(/\s*-\s*/);
  if (parts.length === 2) {
    const [start, endRaw] = parts as [string, string];
    let end = endRaw.trim();

    if (!LEADING_MONTH_RE.test(end)) {
      const startMonth = extractMonth(start);
      if (startMonth) end = `${startMonth} ${end}`;
    }

    if (!extractYear(end)) {
      const startYear = extractYear(start);
      if (startYear) end = `${end}, ${startYear}`;
    }

    const parsedEnd = new Date(end);
    if (!Number.isNaN(parsedEnd.getTime())) return parsedEnd.toISOString();
  }

  // Genuinely unparseable — pass the real text through unchanged rather
  // than guess. isWorthKeeping()/calculateUrgency() already handle this
  // case (empty/invalid -> excluded), so nothing downstream needs to
  // change to stay safe.
  return trimmed;
}
