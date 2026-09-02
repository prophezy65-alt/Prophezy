/**
 * lib/interview/prompts/generation.ts
 *
 * Question generation for every interview type is the same shape (context
 * in, ranked question set out), so instead of 22 near-duplicate prompt
 * files we have one factory that specializes a shared PromptDefinition per
 * InterviewType. This keeps the "dedicated prompt per type" requirement
 * (each type gets its own tailored system prompt text) without the
 * copy-paste maintenance cost of 22 files.
 */
import { wrapUserContent } from "../../ai/middleware/safety";
import { JSON_ONLY_SUFFIX, type PromptDefinition } from "../../ai/prompts/_shared";
import type { InterviewType, Seniority } from "../models/interview.model";

export interface QuestionGenInput {
  role: string;
  seniority: Seniority;
  company?: string;
  jobDescription?: string;
  resumeText?: string;
  projectContext?: string;
  skills?: string[];
  questionCount: number;
}

export interface QuestionGenOutput {
  questions: {
    question: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    source: string;
  }[];
}

const TYPE_FOCUS: Record<InterviewType, string> = {
  hr: "HR screening: motivation, culture fit, salary expectations, availability, career trajectory.",
  technical: "General technical fundamentals for the candidate's stack, correctness and depth of understanding.",
  coding: "Data-structure and algorithm problems solvable in an interview, ranging from warm-up to the candidate's seniority level.",
  behavioral: "STAR-style behavioral questions probing teamwork, conflict, ownership, and failure recovery.",
  "system-design": "Open-ended system design problems appropriate to seniority (single-service for junior, distributed/scale trade-offs for senior+).",
  "ai-ml": "ML fundamentals, model selection, evaluation metrics, data pipelines, and applied ML system questions.",
  "data-science": "Statistics, experimentation/A-B testing, SQL, and case-study style business-data questions.",
  "software-engineering": "Software design principles, code quality, testing strategy, and engineering trade-offs.",
  frontend: "UI architecture, state management, performance, accessibility, and browser fundamentals.",
  backend: "API design, databases, concurrency, caching, and service reliability.",
  "full-stack": "End-to-end feature ownership spanning frontend, backend, and data layer decisions.",
  devops: "CI/CD, infrastructure as code, containers/orchestration, monitoring, and incident response.",
  cloud: "Cloud architecture, cost/scaling trade-offs, managed services, and security posture.",
  "cyber-security": "Threat modeling, common vulnerability classes, secure design, and incident response.",
  "business-analyst": "Requirements gathering, stakeholder management, process mapping, and data-informed recommendations.",
  "product-manager": "Product sense, prioritization frameworks, metrics definition, and stakeholder trade-offs.",
  research: "Research methodology, literature grounding, experiment design, and critical evaluation of results.",
  medical: "Clinical reasoning and case-based questions appropriate to the stated specialty and training level.",
  law: "Issue-spotting, statutory/case reasoning, and applied legal analysis appropriate to the stated area of law.",
  mba: "Case-study business problems, market sizing, strategy trade-offs, and leadership scenarios.",
  "college-viva": "Curriculum-grounded conceptual questions a viva examiner would ask, testing fundamentals over memorization.",
  "school-viva": "Curriculum-grounded oral-exam questions a school teacher/examiner would ask strictly from the provided syllabus/material, testing understanding of school-level fundamentals in simple language.",
  "practical-exam": "Applied, hands-on problem statements testing practical execution over theory.",
};

export function buildQuestionGenPrompt(
  interviewType: InterviewType
): PromptDefinition<QuestionGenInput, QuestionGenOutput> {
  return {
    version: "interview.generation.v1",
    feature: "interview-generate",
    systemPrompt: [
      `You generate interview questions for a "${interviewType}" interview.`,
      `Focus area: ${TYPE_FOCUS[interviewType]}`,
      "Tailor difficulty to the candidate's stated seniority. Prefer questions " +
        "grounded in the candidate's actual resume, projects, skills, or the " +
        "job/company context provided over generic questions — set `source` " +
        "to what grounded each question (e.g. 'resume', 'project:<name>', " +
        "'jd', 'skill:<name>', 'generic'). Order questions from easier to " +
        "harder. Do not repeat the same underlying concept twice.",
      JSON_ONLY_SUFFIX,
    ].join("\n\n"),
    buildUserPrompt: (input) => {
      const blocks = [
        `Role: ${input.role}`,
        `Seniority: ${input.seniority}`,
        input.company ? `Target company: ${input.company}` : "",
        `Question count: ${input.questionCount}`,
        input.skills?.length ? `Declared skills: ${input.skills.join(", ")}` : "",
        input.jobDescription ? wrapUserContent("job_description", input.jobDescription) : "",
        input.resumeText ? wrapUserContent("resume", input.resumeText) : "",
        input.projectContext ? wrapUserContent("project_context", input.projectContext) : "",
      ].filter(Boolean);
      return blocks.join("\n\n");
    },
    responseSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              topic: { type: "string" },
              difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              source: { type: "string" },
            },
            required: ["question", "topic", "difficulty", "source"],
          },
        },
      },
      required: ["questions"],
    },
    generation: { temperature: 0.6, maxOutputTokens: 4096 },
  };
}
