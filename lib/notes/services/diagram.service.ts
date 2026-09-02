/**
 * lib/notes/services/diagram.service.ts
 *
 * Renders Mermaid flowcharts for process/algorithm-shaped topics (typically
 * from "flow_notes" note type output). Unlike mindmap.service.ts, there's
 * no dedicated AI schema for this — flow_notes topics are still plain
 * NotesOutput prose, so this derives a flowchart heuristically from a
 * topic's summary text (splitting on numbered-step patterns the flow_notes
 * prompt is instructed to produce) rather than requiring a second AI call.
 * If the heuristic finds no clear steps, it falls back to a single node so
 * callers always get valid Mermaid back.
 */

import type { NoteGenerationOutput, NotesOutput, Topic } from "../models/types";

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "topics" in content;
}

function slugify(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30);
  return `${base || "step"}-${index}`;
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").slice(0, 80);
}

/** Splits a topic summary into ordered steps, using numbered-list patterns ("1.", "1)", "Step 1:") if present. */
function extractSteps(summary: string): string[] {
  const numbered = summary
    .split(/(?:^|\n)\s*(?:\d+[.)]|step\s*\d+:?)\s*/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  if (numbered.length > 1) return numbered;

  // Fallback: split on sentence boundaries so there's still a usable sequence.
  return summary
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Builds a Mermaid `graph TD` flowchart string for one topic's step sequence. */
export function buildFlowchartForTopic(topic: Topic): string {
  const steps = extractSteps(topic.summary);
  const lines = ["graph TD"];

  if (steps.length === 0) {
    lines.push(`  s0["${escapeLabel(topic.title)}"]`);
    return lines.join("\n");
  }

  const ids = steps.map((step, i) => slugify(step, i));
  ids.forEach((id, i) => lines.push(`  ${id}["${escapeLabel(steps[i]!)}"]`));
  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }

  return lines.join("\n");
}

/** Builds one flowchart per topic in a generation's output, keyed by topic title. */
export function buildFlowchartsForNotes(content: NoteGenerationOutput): Record<string, string> {
  if (!isProseNotes(content)) return {};
  const out: Record<string, string> = {};
  for (const topic of content.topics) {
    out[topic.title] = buildFlowchartForTopic(topic);
  }
  return out;
}
