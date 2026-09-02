/**
 * lib/notes/prompts/_factory.ts
 *
 * All ten "prose" note types (detailed, short, revision, exam, one_page,
 * chapter, unit, topic, lecture, cheat_sheet, formula_sheet,
 * definition_sheet, key_points, comparison_table) return the exact same
 * `NotesOutput` shape — they differ only in *emphasis* (a revision note
 * leans on keyPoints/mnemonics, a formula sheet leans on formulas, etc.).
 *
 * Rather than hand-write ten near-identical PromptDefinitions, every
 * concrete file in this folder (detailed-notes.prompt.ts,
 * revision-notes.prompt.ts, ...) calls this single factory with its own
 * feature slug + emphasis copy. This is the DRY mechanism the project's
 * architecture rules ask for.
 *
 * IMPORTANT: this file has zero knowledge of Gemini. It only builds
 * PromptDefinition objects consumed by lib/ai/services/_run-structured.ts —
 * exactly like every other feature's prompts.
 */

import type { PromptDefinition } from "../../ai/prompts/_shared";
import { JSON_ONLY_SUFFIX } from "../../ai/prompts/_shared";
import type { LearningMode, NoteType, OutputStyle } from "../models/types";

export interface NotesPromptInput {
  sourceText: string;
  sourceTitle?: string;
  focusTopic?: string;
  learningMode?: LearningMode;
  outputStyle?: OutputStyle;
  lengthHint?: "very_short" | "short" | "medium" | "long";
}

/** JSON Schema for the shared NotesOutput shape (see models/types.ts). */
export const NOTES_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    overview: { type: "string" },
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          importance: { type: "string", enum: ["low", "medium", "high"] },
          estimatedStudyMinutes: { type: "number" },
          subtopics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                keyPoints: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      importance: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["text"],
                  },
                },
                definitions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      term: { type: "string" },
                      definition: { type: "string" },
                      example: { type: "string" },
                    },
                    required: ["term", "definition"],
                  },
                },
                examples: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { title: { type: "string" }, explanation: { type: "string" } },
                    required: ["title", "explanation"],
                  },
                },
              },
              required: ["title", "summary"],
            },
          },
        },
        required: ["title", "summary"],
      },
    },
    keyPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          importance: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["text"],
      },
    },
    definitions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          definition: { type: "string" },
          example: { type: "string" },
        },
        required: ["term", "definition"],
      },
    },
    formulas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          expression: { type: "string" },
          whenToUse: { type: "string" },
          variables: {
            type: "array",
            items: {
              type: "object",
              properties: { symbol: { type: "string" }, meaning: { type: "string" } },
              required: ["symbol", "meaning"],
            },
          },
        },
        required: ["name", "expression"],
      },
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, explanation: { type: "string" } },
        required: ["title", "explanation"],
      },
    },
    mnemonics: {
      type: "array",
      items: {
        type: "object",
        properties: { forConcept: { type: "string" }, device: { type: "string" } },
        required: ["forConcept", "device"],
      },
    },
    faqs: {
      type: "array",
      items: {
        type: "object",
        properties: { question: { type: "string" }, answer: { type: "string" } },
        required: ["question", "answer"],
      },
    },
    examTips: { type: "array", items: { type: "string" } },
    commonMistakes: { type: "array", items: { type: "string" } },
    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    estimatedStudyMinutes: { type: "number" },
  },
  required: [
    "title",
    "overview",
    "topics",
    "keyPoints",
    "definitions",
    "formulas",
    "examples",
    "mnemonics",
    "faqs",
    "examTips",
    "commonMistakes",
    "difficulty",
    "estimatedStudyMinutes",
  ],
};

function buildUserPrompt(input: NotesPromptInput): string {
  const parts: string[] = [];

  if (input.sourceTitle) parts.push(`Source title: ${input.sourceTitle}`);
  if (input.focusTopic) parts.push(`Focus only on this topic/chapter within the source: ${input.focusTopic}`);
  if (input.learningMode) parts.push(`Learning mode: ${input.learningMode}`);
  if (input.outputStyle) parts.push(`Preferred output style: ${input.outputStyle}`);
  if (input.lengthHint) parts.push(`Target length: ${input.lengthHint}`);

  parts.push("--- SOURCE CONTENT START ---");
  parts.push(input.sourceText);
  parts.push("--- SOURCE CONTENT END ---");

  return parts.join("\n");
}

export interface NotesPromptConfig {
  /** e.g. "notes-detailed", "notes-revision" — used for model routing + rate limiting, must be unique per note type. */
  feature: string;
  version: string;
  /** What this note type should emphasize, in plain English, appended to the shared base instruction. */
  emphasis: string;
  temperature?: number;
  maxOutputTokens?: number;
}

const BASE_SYSTEM_PROMPT = `You are the Notes Intelligence Engine inside Prophezy, an AI study companion.
Given raw source content (a book excerpt, PDF/DOCX/PPTX extraction, lecture transcript,
research paper, assignment, or syllabus section), produce structured study notes.

Rules:
- Base every fact strictly on the provided source content. Do not invent facts, numbers,
  citations, or examples that aren't supported by the source or standard textbook knowledge
  of the same subject.
- Write for a student who wants to actually learn and retain the material, not just skim it.
- Prefer clear, concrete language over filler. Every topic/point should earn its place.
- If the source content is too short or unclear to extract something (e.g. no formulas exist),
  return an empty array for that field rather than fabricating content.`;

/**
 * Builds a complete PromptDefinition for one prose note type. Each concrete
 * prompt file (detailed-notes.prompt.ts, etc.) is just a call to this.
 */
export function createNotesPromptDefinition(
  config: NotesPromptConfig
): PromptDefinition<NotesPromptInput, import("../models/types").NotesOutput> {
  return {
    version: config.version,
    feature: config.feature,
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\nEmphasis for this note type: ${config.emphasis}\n\n${JSON_ONLY_SUFFIX}`,
    buildUserPrompt,
    responseSchema: NOTES_OUTPUT_SCHEMA,
    generation: {
      temperature: config.temperature ?? 0.4,
      maxOutputTokens: config.maxOutputTokens ?? 8192,
    },
  };
}
