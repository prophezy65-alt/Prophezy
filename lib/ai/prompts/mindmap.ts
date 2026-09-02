/**
 * lib/ai/prompts/mindmap.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface MindmapInput {
  topic: string;
  sourceText?: string;
  maxDepth?: number;
}

export interface MindmapNode {
  label: string;
  children?: MindmapNode[];
}

export interface MindmapOutput {
  root: MindmapNode;
  mermaid: string;
}

export const MINDMAP_PROMPT: PromptDefinition<MindmapInput, MindmapOutput> = {
  version: "mindmap.v1",
  feature: "mindmap",
  systemPrompt:
    "You turn a topic (and optional source material) into a hierarchical " +
    "mind map. Keep branches balanced — don't put 10 children under one node " +
    "and 1 under another unless the material genuinely justifies it. Also " +
    "produce a valid Mermaid `mindmap` diagram string representing the same " +
    "structure. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Topic: " + input.topic,
      "Max depth: " + (input.maxDepth ?? 3),
      input.sourceText ? wrapUserContent("source_text", input.sourceText) : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      root: {
        type: "object",
        properties: {
          label: { type: "string" },
          children: { type: "array", items: { type: "object" } },
        },
        required: ["label"],
      },
      mermaid: { type: "string" },
    },
    required: ["root", "mermaid"],
  },
  generation: { temperature: 0.5, maxOutputTokens: 3072 },
};
