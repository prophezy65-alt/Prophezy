/**
 * lib/notes/prompts/mindmap.prompt.ts
 *
 * Mind maps return a graph shape (nodes/edges), not the prose NotesOutput
 * shape every other note type uses — so this bypasses _factory.ts and
 * builds its own PromptDefinition directly, the same way _factory.ts
 * itself is built. The prompt asks Gemini to generate both the structured
 * graph AND a ready-to-render Mermaid `graph TD` string in one call, so
 * lib/notes/services/mindmap.service.ts never has to derive one from the
 * other (that derivation is easy to get subtly wrong — e.g. id collisions,
 * missing quoting of labels with special characters).
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import type { NotesPromptInput } from "./_factory";
import type { MindMapOutput } from "../models/types";

const MINDMAP_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          parentId: { type: ["string", "null"] },
        },
        required: ["id", "label"],
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" },
        },
        required: ["from", "to"],
      },
    },
    mermaid: { type: "string" },
  },
  required: ["title", "nodes", "edges", "mermaid"],
};

function buildUserPrompt(input: NotesPromptInput): string {
  const parts: string[] = [];
  if (input.sourceTitle) parts.push(`Source title: ${input.sourceTitle}`);
  if (input.focusTopic) parts.push(`Focus only on this topic/chapter: ${input.focusTopic}`);
  parts.push(
    "Build a mind map: one root node for the central topic, branching into main topics, " +
      "then subtopics, at most 3 levels deep. Keep labels short (3-6 words). Node ids must be " +
      "unique short slugs (e.g. 'root', 'topic-1', 'topic-1-sub-2') referenced consistently " +
      "between `nodes`, `edges`, and the `mermaid` string."
  );
  parts.push("--- SOURCE CONTENT START ---");
  parts.push(input.sourceText);
  parts.push("--- SOURCE CONTENT END ---");
  return parts.join("\n");
}

export const MINDMAP_PROMPT: PromptDefinition<NotesPromptInput, MindMapOutput> = {
  version: "1.0.0",
  feature: "notes-mindmap",
  systemPrompt:
    `You are the Notes Intelligence Engine inside Prophezy, generating a mind map from study ` +
    `content. Extract the hierarchical structure of ideas in the source (central topic -> main ` +
    `branches -> sub-branches). Base every node strictly on the source content — do not invent ` +
    `topics that aren't present. The 'mermaid' field must be a valid Mermaid 'graph TD' ` +
    `definition using the exact same node ids as in 'nodes', e.g.:\n` +
    `graph TD\n  root["Central Topic"]\n  root --> t1["Main Topic 1"]\n  t1 --> t1s1["Subtopic"]\n\n` +
    `${JSON_ONLY_SUFFIX}`,
  buildUserPrompt,
  responseSchema: MINDMAP_SCHEMA,
  generation: { temperature: 0.4, maxOutputTokens: 4096 },
};
