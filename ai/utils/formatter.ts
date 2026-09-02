/**
 * lib/ai/utils/formatter.ts
 *
 * Converts between the output shapes the app needs: markdown -> plain text
 * (for previews/notifications), markdown -> safe-ish HTML (for rendering),
 * and generic whitespace/formatting cleanup applied to every raw Gemini
 * response before it reaches a service's return value.
 */

/** Collapses excess blank lines and trims trailing whitespace per line. */
export function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strips markdown syntax down to plain text (for previews/snippets/emails). */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^-{3,}$/gm, "")
    .trim();
}

/**
 * Minimal, dependency-free markdown -> HTML for headings, bold/italic,
 * inline code, fenced code, and paragraphs. For anything richer, render
 * markdown client-side with a proper library (react-markdown) instead of
 * expanding this function.
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><code class="language-${lang ?? "text"}">${escaped}</code></pre>`;
  });

  html = html
    .replace(/^###### (.*)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.*)$/gm, "<h5>$1</h5>")
    .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>")
    .replace(/(\*|_)(.*?)\1/g, "<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html
    .split(/\n{2,}/)
    .map((block) =>
      block.startsWith("<h") || block.startsWith("<pre")
        ? block
        : `<p>${block.replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");

  return html;
}

/** Truncates text to a max length on a word boundary, adding an ellipsis. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}
