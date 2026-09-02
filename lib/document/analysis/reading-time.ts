/**
 * lib/document/analysis/reading-time.ts
 * Standard 200-230 wpm average adult reading speed estimate. Uses 220 as a
 * reasonable midpoint; complexity-adjusted (slower for graduate-level text).
 */

export function estimateReadingTimeMinutes(wordCount: number, complexityScore = 50): number {
  const baseWpm = 220;
  // Denser/harder text is read slower — scale down wpm by up to 30% at max complexity.
  const adjustedWpm = baseWpm * (1 - (complexityScore / 100) * 0.3);
  const minutes = wordCount / adjustedWpm;
  return Math.max(1, Math.round(minutes));
}
