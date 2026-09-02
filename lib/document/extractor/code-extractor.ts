/**
 * lib/document/extractor/code-extractor.ts
 * markdown.provider.ts already extracts fenced code blocks natively for
 * markdown sources. This handles the other providers (PDF/DOCX/TXT), where
 * code shows up as consistently-indented blocks or recognizable syntax
 * patterns rather than triple-backtick fences.
 */

import type { CodeBlock } from "../models/content-block.model";

const LANGUAGE_SIGNATURES: { pattern: RegExp; language: string }[] = [
  { pattern: /^\s*(def |import |from .+ import|class .+:)/m, language: "python" },
  { pattern: /^\s*(function |const |let |var |=>|console\.log)/m, language: "javascript" },
  { pattern: /^\s*(public |private |class .+\{|System\.out)/m, language: "java" },
  { pattern: /^\s*(#include|int main\()/m, language: "c" },
  { pattern: /^\s*(SELECT |INSERT INTO|CREATE TABLE)/im, language: "sql" },
];

/** Groups consecutive lines that are indented >= 4 spaces relative to surrounding prose. */
export function detectCodeBlocks(text: string, pageIndex: number): CodeBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: CodeBlock[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length >= 2) {
      const code = buffer.join("\n");
      blocks.push({
        id: `detected_code_${blocks.length}`,
        pageIndex,
        language: guessLanguage(code),
        code,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const isIndented = /^ {4,}\S/.test(line) || /^\t\S/.test(line);
    if (isIndented) {
      buffer.push(line.replace(/^ {4}|\t/, ""));
    } else if (line.trim() === "" && buffer.length > 0) {
      buffer.push("");
    } else {
      flush();
    }
  }
  flush();

  return blocks;
}

function guessLanguage(code: string): string | null {
  for (const sig of LANGUAGE_SIGNATURES) {
    if (sig.pattern.test(code)) return sig.language;
  }
  return null;
}
