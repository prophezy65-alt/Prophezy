/**
 * lib/ai/prompts/research.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface ResearchInput {
  topic: string;
  depth?: "overview" | "deep-dive";
  sourceMaterial?: string; // e.g. OCR'd paper text, abstract, notes
}

export interface ResearchOutput {
  overview: string;
  keyFindings: string[];
  openQuestions: string[];
  suggestedSubtopics: string[];
  glossary: { term: string; definition: string }[];
}

export const RESEARCH_PROMPT: PromptDefinition<ResearchInput, ResearchOutput> = {
  version: "research.v1",
  feature: "research",
  systemPrompt:
    "You are a research assistant helping a student or academic understand and " +
    "organize a topic. You explain concepts precisely, flag genuine open " +
    "questions or controversies rather than presenting a topic as more settled " +
    "than it is, and never fabricate citations, study names, or statistics. If " +
    "source material is provided, ground your answer in it; otherwise rely on " +
    "well-established general knowledge and say so. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      "Topic: " + input.topic,
      "Depth: " + (input.depth ?? "overview"),
      input.sourceMaterial ? wrapUserContent("source_material", input.sourceMaterial) : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      overview: { type: "string" },
      keyFindings: { type: "array", items: { type: "string" } },
      openQuestions: { type: "array", items: { type: "string" } },
      suggestedSubtopics: { type: "array", items: { type: "string" } },
      glossary: {
        type: "array",
        items: {
          type: "object",
          properties: { term: { type: "string" }, definition: { type: "string" } },
          required: ["term", "definition"],
        },
      },
    },
    required: ["overview", "keyFindings", "openQuestions", "suggestedSubtopics", "glossary"],
  },
  generation: { temperature: 0.4, maxOutputTokens: 4096 },
};
