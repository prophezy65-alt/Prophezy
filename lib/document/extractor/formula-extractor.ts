/**
 * lib/document/extractor/formula-extractor.ts
 * Real image-based formula OCR is handled by ocr.provider.ts's
 * runFormulaOcr (needs wiring). This is the text-layer companion: detects
 * inline/block math expressions already present as text (e.g. "E = mc^2",
 * "∫f(x)dx", LaTeX-delimited "$...$" or "\[...\]") in PDF/DOCX/TXT sources.
 */

import type { Formula } from "../models/content-block.model";

const LATEX_INLINE = /\$([^$\n]{1,300})\$/g;
const LATEX_BLOCK = /\\\[([\s\S]{1,1000}?)\\\]/g;
const SIMPLE_EQUATION = /\b([A-Za-z](?:_\w+)?(?:\s*[+\-*/^]\s*[A-Za-z0-9_().]+){0,4}\s*=\s*[^.\n]{2,80})/g;
const MATH_SYMBOL_LINE = /^[^a-zA-Z]*[∫∑∏√±≤≥≠∞π∂∇][^\n]{0,120}$/m;

export function detectFormulas(text: string, pageIndex: number): Formula[] {
  const formulas: Formula[] = [];
  const seen = new Set<string>();

  const add = (raw: string, isInline: boolean) => {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    formulas.push({ id: `formula_${formulas.length}`, pageIndex, raw: trimmed, isInline });
  };

  let m: RegExpExecArray | null;
  while ((m = LATEX_BLOCK.exec(text)) !== null) add(m[1]!, false);
  while ((m = LATEX_INLINE.exec(text)) !== null) add(m[1]!, true);
  while ((m = SIMPLE_EQUATION.exec(text)) !== null) add(m[1]!, true);

  for (const line of text.split(/\r?\n/)) {
    if (MATH_SYMBOL_LINE.test(line)) add(line, false);
  }

  return formulas;
}
