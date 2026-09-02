/**
 * lib/notes/services/formatter.service.ts
 *
 * Converts generated note output into renderable/exportable formats.
 * Markdown is the one format this file actually builds by hand (the
 * structured JSON has no markdown of its own to reuse); HTML and plain
 * text are then derived from that markdown using the *existing*
 * lib/ai/utils/formatter.ts helpers, per the "never duplicate code" rule —
 * this file does not implement its own markdown->HTML converter.
 */

import { markdownToHtml, markdownToPlainText } from "../../ai/utils/formatter";
import type {
  FlashcardsOutput,
  MindMapOutput,
  NoteGenerationOutput,
  NotesOutput,
} from "../models/types";

function isMindMap(output: NoteGenerationOutput): output is MindMapOutput {
  return "nodes" in output && "edges" in output;
}

function isFlashcards(output: NoteGenerationOutput): output is FlashcardsOutput {
  return "cards" in output;
}

function renderProseNotesMarkdown(notes: NotesOutput): string {
  const lines: string[] = [`# ${notes.title}`, "", notes.overview, ""];

  if (notes.topics.length > 0) {
    lines.push("## Topics", "");
    for (const topic of notes.topics) {
      lines.push(`### ${topic.title}`, "", topic.summary, "");
      for (const sub of topic.subtopics ?? []) {
        lines.push(`#### ${sub.title}`, "", sub.summary, "");
        for (const kp of sub.keyPoints ?? []) lines.push(`- ${kp.text}`);
        for (const def of sub.definitions ?? [])
          lines.push(`- **${def.term}**: ${def.definition}`);
        lines.push("");
      }
    }
  }

  if (notes.definitions.length > 0) {
    lines.push("## Definitions", "");
    for (const d of notes.definitions) lines.push(`- **${d.term}**: ${d.definition}`);
    lines.push("");
  }

  if (notes.formulas.length > 0) {
    lines.push("## Formulas", "");
    for (const f of notes.formulas) {
      lines.push(`- **${f.name}**: \`${f.expression}\`${f.whenToUse ? ` — ${f.whenToUse}` : ""}`);
    }
    lines.push("");
  }

  if (notes.keyPoints.length > 0) {
    lines.push("## Key Points", "");
    for (const kp of notes.keyPoints) lines.push(`- ${kp.text}`);
    lines.push("");
  }

  if (notes.examples.length > 0) {
    lines.push("## Examples", "");
    for (const ex of notes.examples) lines.push(`- **${ex.title}**: ${ex.explanation}`);
    lines.push("");
  }

  if (notes.mnemonics.length > 0) {
    lines.push("## Mnemonics", "");
    for (const m of notes.mnemonics) lines.push(`- **${m.forConcept}**: ${m.device}`);
    lines.push("");
  }

  if (notes.faqs.length > 0) {
    lines.push("## FAQs", "");
    for (const f of notes.faqs) lines.push(`- **Q:** ${f.question}\n  **A:** ${f.answer}`);
    lines.push("");
  }

  if (notes.examTips.length > 0) {
    lines.push("## Exam Tips", "");
    for (const tip of notes.examTips) lines.push(`- ${tip}`);
    lines.push("");
  }

  if (notes.commonMistakes.length > 0) {
    lines.push("## Common Mistakes", "");
    for (const m of notes.commonMistakes) lines.push(`- ${m}`);
    lines.push("");
  }

  lines.push(
    `*Difficulty: ${notes.difficulty} · Estimated study time: ${notes.estimatedStudyMinutes} min*`
  );

  return lines.join("\n");
}

function renderMindMapMarkdown(map: MindMapOutput): string {
  return [`# ${map.title}`, "", "```mermaid", map.mermaid, "```"].join("\n");
}

function renderFlashcardsMarkdown(deck: FlashcardsOutput): string {
  const lines = [`# ${deck.title}`, ""];
  deck.cards.forEach((card, i) => {
    lines.push(`**${i + 1}. ${card.front}**`, "", card.back, "");
  });
  return lines.join("\n");
}

/** Renders any generated note output type to markdown. */
export function toMarkdown(output: NoteGenerationOutput): string {
  if (isMindMap(output)) return renderMindMapMarkdown(output);
  if (isFlashcards(output)) return renderFlashcardsMarkdown(output);
  return renderProseNotesMarkdown(output);
}

/** Renders any generated note output type to safe-ish HTML, via the shared markdown->HTML utility. */
export function toHtml(output: NoteGenerationOutput): string {
  return markdownToHtml(toMarkdown(output));
}

/** Renders any generated note output type to plain text, for previews/notifications/exports. */
export function toPlainText(output: NoteGenerationOutput): string {
  return markdownToPlainText(toMarkdown(output));
}

/** Renders any generated note output type to a JSON string (pretty-printed for file export). */
export function toJson(output: NoteGenerationOutput): string {
  return JSON.stringify(output, null, 2);
}
