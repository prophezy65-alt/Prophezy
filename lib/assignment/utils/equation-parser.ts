// lib/assignment/utils/equation-parser.ts
// Deterministic detection of equation-like spans in extracted text: LaTeX
// delimiters ($...$, $$...$$, \(...\), \[...\]) plus a heuristic fallback for
// unicode math notation that wasn't wrapped in delimiters (common after OCR).

import type { ExtractedEquation } from "../models/types";

const LATEX_PATTERNS: RegExp[] = [
  /\$\$([\s\S]+?)\$\$/g, // display math
  /\$([^$\n]+?)\$/g, // inline math
  /\\\[([\s\S]+?)\\\]/g, // \[ ... \]
  /\\\(([\s\S]+?)\\\)/g, // \( ... \)
];

const UNICODE_MATH_CHARS = /[∑∫√π≤≥≠±∞∂∇×÷≈∈∉⊂⊆∪∩]/;

export function extractEquations(text: string, idPrefix = "eq"): ExtractedEquation[] {
  const equations: ExtractedEquation[] = [];
  let index = 0;
  const claimedSpans: Array<[number, number]> = [];

  for (const pattern of LATEX_PATTERNS) {
    const re = new RegExp(pattern);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const [full, inner] = match;
      claimedSpans.push([match.index, match.index + full.length]);
      equations.push({
        id: `${idPrefix}-${index++}`,
        raw: full,
        latex: inner!.trim(),
      });
      if (re.lastIndex === match.index) re.lastIndex++;
    }
  }

  // Fallback: lines containing unicode math symbols not already captured by
  // an explicit LaTeX delimiter above — common after OCR on scanned math.
  const lines = text.split("\n");
  let cursor = 0;
  for (const line of lines) {
    const lineStart = cursor;
    cursor += line.length + 1;
    if (!UNICODE_MATH_CHARS.test(line)) continue;

    const alreadyClaimed = claimedSpans.some(
      ([start, end]) => lineStart >= start && lineStart < end
    );
    if (alreadyClaimed) continue;
    if (line.trim().length === 0) continue;

    equations.push({
      id: `${idPrefix}-${index++}`,
      raw: line.trim(),
      latex: undefined,
    });
  }

  return equations;
}
