// lib/humanizer/utils/formatter.ts
// Deterministic fallback for bullet<->paragraph conversion (used if the AI
// call fails) and general text-formatting helpers.

export function paragraphToBulletsHeuristic(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return sentences.map((s) => `- ${s.replace(/[.!?]+$/, "")}`).join("\n");
}

export function bulletsToParagraphHeuristic(text: string): string {
  const bullets = text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0);

  return bullets
    .map((b, i) => {
      const capitalized = b.charAt(0).toUpperCase() + b.slice(1);
      const withPeriod = /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
      return withPeriod;
    })
    .join(" ");
}

export function countBulletLines(text: string): number {
  return text.split("\n").filter((line) => /^\s*[-*•]\s+/.test(line)).length;
}
