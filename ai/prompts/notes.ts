/**
 * lib/ai/prompts/notes.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface NotesInput {
  sourceText: string;
  format?: "outline" | "cornell" | "summary";
}

export interface NotesOutput {
  title: string;
  keyPoints: string[];
  sections: { heading: string; content: string }[];
  summary: string;
}

export const NOTES_PROMPT: PromptDefinition<NotesInput, NotesOutput> = {
  version: "notes.v1",
  feature: "notes",
  systemPrompt:
    "You convert raw source material (lecture transcript, textbook excerpt, " +
    "OCR'd slides) into clean, organized study notes. Preserve the original " +
    "structure where it's already logical; reorganize only when the source " +
    "material is disorganized. Don't add outside facts not present in or " +
    "directly implied by the source. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      wrapUserContent("source_text", input.sourceText),
      "Format: " + (input.format ?? "outline"),
    ].join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      keyPoints: { type: "array", items: { type: "string" } },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: { heading: { type: "string" }, content: { type: "string" } },
          required: ["heading", "content"],
        },
      },
      summary: { type: "string" },
    },
    required: ["title", "keyPoints", "sections", "summary"],
  },
  generation: { temperature: 0.4, maxOutputTokens: 4096 },
};
