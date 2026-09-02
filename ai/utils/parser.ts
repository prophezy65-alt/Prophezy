/**
 * lib/ai/utils/parser.ts
 *
 * Parses structured content out of raw model text: markdown sections,
 * fenced code blocks, Mermaid diagrams, and CSV — used by services whose
 * prompts ask for a specific output shape (mindmap.service, roadmap.service,
 * notes.service, etc).
 */

export interface CodeBlock {
  language: string | null;
  code: string;
}

/** Extracts every fenced code block (```lang\n...\n```) from text. */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ language: match[1] ?? null, code: match[2]!.trim() });
  }
  return blocks;
}

/** Pulls out the first Mermaid diagram block, if any. */
export function extractMermaid(text: string): string | null {
  const blocks = extractCodeBlocks(text);
  const mermaid = blocks.find((b) => b.language?.toLowerCase() === "mermaid");
  return mermaid?.code ?? null;
}

/** Splits markdown into sections keyed by their heading text. */
export function splitByHeadings(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split("\n");
  let currentHeading = "_intro";
  let buffer: string[] = [];

  const flush = () => {
    sections[currentHeading] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1]!.trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

/** Parses a simple CSV block (no quoted-comma edge cases beyond RFC basics). */
export function parseCsv(csv: string): string[][] {
  return csv
    .trim()
    .split("\n")
    .map((line) =>
      line
        .split(",")
        .map((cell) => cell.trim().replace(/^"(.*)"$/, "$1"))
    );
}

/** Strips any leading conversational preamble Gemini adds before real content. */
export function stripPreamble(text: string, markers: string[] = ["```", "#", "{", "["]): string {
  const lines = text.split("\n");
  const idx = lines.findIndex((line) =>
    markers.some((m) => line.trim().startsWith(m))
  );
  return idx === -1 ? text.trim() : lines.slice(idx).join("\n").trim();
}
