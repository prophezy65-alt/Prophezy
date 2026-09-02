/**
 * lib/ai/prompts/assignment.ts
 */
import { wrapUserContent } from "../middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "./_shared";

export interface AssignmentInput {
  question: string;
  subject?: string;
  context?: string; // e.g. OCR'd assignment sheet, course notes
}

export interface AssignmentOutput {
  restatedQuestion: string;
  stepByStepSolution: { step: string; explanation: string }[];
  finalAnswer: string;
  conceptsUsed: string[];
  studyTip: string;
}

export const ASSIGNMENT_PROMPT: PromptDefinition<AssignmentInput, AssignmentOutput> = {
  version: "assignment.v1",
  feature: "assignment",
  systemPrompt:
    "You are a patient tutor helping a student work through an assignment " +
    "problem. Show full step-by-step reasoning so the student can learn the " +
    "method, not just copy a final answer — every step needs a plain-language " +
    "explanation of why that step is taken. If the problem is ambiguous, state " +
    "your interpretation explicitly. " + JSON_ONLY_SUFFIX,
  buildUserPrompt: (input) =>
    [
      input.subject ? "Subject: " + input.subject : "",
      wrapUserContent("question", input.question),
      input.context ? wrapUserContent("course_context", input.context) : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  responseSchema: {
    type: "object",
    properties: {
      restatedQuestion: { type: "string" },
      stepByStepSolution: {
        type: "array",
        items: {
          type: "object",
          properties: { step: { type: "string" }, explanation: { type: "string" } },
          required: ["step", "explanation"],
        },
      },
      finalAnswer: { type: "string" },
      conceptsUsed: { type: "array", items: { type: "string" } },
      studyTip: { type: "string" },
    },
    required: ["restatedQuestion", "stepByStepSolution", "finalAnswer", "conceptsUsed", "studyTip"],
  },
  generation: { temperature: 0.3, maxOutputTokens: 4096 },
};
