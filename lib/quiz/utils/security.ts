/**
 * lib/quiz/utils/security.ts
 *
 * lib/ai/middleware/safety.ts (sanitizeInput) already runs on every message
 * inside runAI() — this file is a second, quiz-specific pass applied BEFORE
 * that, at the point user input enters this module (topic strings, raw
 * "text" source uploads, exported filenames), so obviously malformed input
 * never even reaches the AI Core Engine's request path.
 */

const MAX_TOPIC_LENGTH = 300;
const MAX_TEXT_SOURCE_LENGTH = 200_000; // ~50k tokens, generous ceiling before chunking would be needed

const SUSPICIOUS_INSTRUCTION_PATTERNS = [
  /ignore (all )?(previous|prior|above) instructions/i,
  /you are now/i,
  /system prompt/i,
  /disregard (all )?(previous|prior) (rules|instructions)/i,
];

export interface SanitizedInput {
  clean: string;
  flagged: boolean;
  reasons: string[];
}

/**
 * Flags (does not silently strip) likely prompt-injection attempts inside
 * user-supplied "topic" or "text" source input. Flagged content is still
 * passed through — lib/ai/middleware/safety.ts's sanitizeInput() and the
 * system prompt's own instruction-following boundaries are the actual
 * defense; this is a fast pre-check for logging/rate-limit-tightening, not
 * a content filter.
 */
export function preScreenUserInput(raw: string, kind: "topic" | "text"): SanitizedInput {
  const maxLength = kind === "topic" ? MAX_TOPIC_LENGTH : MAX_TEXT_SOURCE_LENGTH;
  const clean = raw.slice(0, maxLength).trim();

  const reasons = SUSPICIOUS_INSTRUCTION_PATTERNS.filter((p) => p.test(clean)).map((p) => p.source);

  return { clean, flagged: reasons.length > 0, reasons };
}

/** Filename sanitization for export.service.ts downloads. */
export function safeFilename(title: string, extension: string): string {
  const base = title.replace(/[^a-z0-9\-_ ]/gi, "").trim().replace(/\s+/g, "_").slice(0, 100) || "quiz";
  return `${base}.${extension}`;
}
