/**
 * text.ts
 * Small shared text-safety helpers for AI-generated copy.
 */

/**
 * If a model response got cut off mid-sentence (token budget exhausted,
 * stream cut short, etc.), drop the trailing partial sentence rather than
 * showing a half-finished clause to the user. Only trims if there's at
 * least one complete sentence to fall back to; otherwise returns the text
 * unchanged rather than returning nothing.
 */
export function trimToCompleteSentence(text: string): string {
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) return trimmed;

  const lastTerminator = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf("!"), trimmed.lastIndexOf("?"));
  if (lastTerminator === -1) return trimmed;
  return trimmed.slice(0, lastTerminator + 1);
}
