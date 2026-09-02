// lib/assignment/prompts/solution.ts
import { PromptDefinition, withJsonSuffix, isPlainObject, isStringArray } from "./_shared";
import { scanAndNeutralizeInjection } from "../validation/security";

export interface SolutionStepRaw {
  stepNumber: number;
  title: string;
  explanation: string;
  formula: string | null;
  code: string | null;
  codeLanguage: string | null;
}

export interface SolutionResponse {
  explanationOfQuestion: string;
  approach: string;
  steps: SolutionStepRaw[];
  finalAnswer: string;
  keyConcepts: string[];
  mermaidDiagrams: string[];
  pseudocode: string | null;
  code: { language: string; content: string } | null;
  suggestedReferences: {
    type: "book" | "paper" | "website" | "standard";
    title: string;
    authors: string[];
    year: number | null;
    publisher: string | null;
    url: string | null;
  }[];
  glossary: { term: string; definition: string }[];
}

const SCHEMA = `{
  "explanationOfQuestion": string,
  "approach": string,
  "steps": [{ "stepNumber": number, "title": string, "explanation": string, "formula": string|null, "code": string|null, "codeLanguage": string|null }],
  "finalAnswer": string,
  "keyConcepts": string[],
  "mermaidDiagrams": string[],
  "pseudocode": string|null,
  "code": { "language": string, "content": string }|null,
  "suggestedReferences": [{ "type": "book"|"paper"|"website"|"standard", "title": string, "authors": string[], "year": number|null, "publisher": string|null, "url": string|null }],
  "glossary": [{ "term": string, "definition": string }]
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You are Prophezy's assignment tutor. Your role is to help a student genuinely
UNDERSTAND a question, not just receive a final answer to copy. You always teach first.

For the given question:
1. explanationOfQuestion: restate what the question is actually asking, in plain terms.
2. approach: describe the strategy to solve it BEFORE showing the solution — the "how
   to think about this" layer.
3. steps: a numbered, pedagogically ordered walkthrough. Each step should teach a single
   idea. Include a "formula" field when a formula is used, and "code"/"codeLanguage"
   when the step involves writing code.
4. finalAnswer: the concise final result or conclusion.
5. keyConcepts: the underlying concepts a student must know to solve this class of
   problem.
6. mermaidDiagrams: valid Mermaid syntax (flowchart/sequence/classDiagram/etc.) ONLY
   when a diagram genuinely aids understanding (e.g. algorithms, processes, system
   architecture, decision trees). Return an empty array if not useful — do not force a
   diagram onto unrelated content.
7. pseudocode: only for algorithmic/programming/database questions where pseudocode
   clarifies logic; otherwise null.
8. code: a real, runnable, correctly-typed code solution ONLY when the question is a
   programming question; otherwise null. Never produce incomplete or placeholder code —
   if you include code, it must fully solve the question.
9. suggestedReferences: 1-4 real, plausible academic references (textbooks, standards,
   or well-known papers) relevant to the topic. If you are not confident a specific
   title/author/year is accurate, prefer a more general, well-known standard reference
   over a fabricated specific one.
10. glossary: 2-6 terms used in the solution that a student may not know, each with a
    one-sentence definition.

Never simply state an answer with no reasoning. Never pad steps with filler. Match the
subject's academic register (e.g. formal derivation for math/physics, working code +
complexity analysis for algorithms, structured argument for essay/case-study questions).`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const rawQuestionText = typeof input.questionText === "string" ? input.questionText : "";
  const questionText = scanAndNeutralizeInjection(rawQuestionText).cleanedText;
  const subject = typeof input.subject === "string" ? input.subject : "general";
  const topic = typeof input.topic === "string" ? input.topic : "general";
  const type = typeof input.type === "string" ? input.type : "short_answer";
  const marks = typeof input.marks === "number" ? input.marks : "unspecified";
  const programmingLanguage = typeof input.programmingLanguage === "string" ? input.programmingLanguage : null;
  const depthMode = input.depthMode === "simple" ? "simple" : input.depthMode === "technical" ? "technical" : "standard";

  return `Question: ${questionText}
Subject: ${subject}
Topic: ${topic}
Type: ${type}
Marks: ${marks}
Programming language (if applicable): ${programmingLanguage ?? "n/a"}
Explanation depth requested: ${depthMode} (simple = accessible plain-language; technical = rigorous academic register; standard = balanced)

Produce the full solution per the schema.`;
}

function validate(parsed: unknown): parsed is SolutionResponse {
  if (!isPlainObject(parsed)) return false;
  if (typeof parsed.explanationOfQuestion !== "string") return false;
  if (typeof parsed.approach !== "string") return false;
  if (!Array.isArray(parsed.steps)) return false;
  if (typeof parsed.finalAnswer !== "string") return false;
  if (!isStringArray(parsed.keyConcepts)) return false;
  if (!isStringArray(parsed.mermaidDiagrams)) return false;
  if (!Array.isArray(parsed.suggestedReferences)) return false;
  if (!Array.isArray(parsed.glossary)) return false;
  return true;
}

/** Full, tutoring-depth solution: explanation, approach, step-by-step
 * walkthrough, diagrams, glossary, references. This is what generates the
 * rich view (Q1 in the assignments UI) — used for on-demand, single-question
 * "Solve" clicks where a 15-30s wait for one answer is reasonable. */
export const solutionPrompt: PromptDefinition<SolutionResponse> = {
  id: "assignment.solution.generate",
  feature: "assignment_solution",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.35,
  maxOutputTokens: 8192,
  validate,
};

/* -------------------------------------------------------------------------- */
/* Short / exam-answer mode                                                   */
/* -------------------------------------------------------------------------- */
// Deliberately a SEPARATE prompt, not a trimmed version of the one above —
// so nothing depending on the full tutoring schema (export/, the rich
// question-detail view) is affected. This mode skips explanation, approach,
// step breakdown, diagrams, glossary, and references entirely: it produces
// only what a student would need to write to get full marks in an exam.
// Much smaller maxOutputTokens (600 vs 8192) so generation itself is faster,
// on top of being a simpler ask — this is what makes solving many questions
// per document tractable instead of every question paying the full
// tutoring-depth latency cost.

export interface ShortSolutionResponse {
  finalAnswer: string;
  workingSummary: string;
  keyFormulaOrCode: string | null;
}

const SHORT_SCHEMA = `{
  "finalAnswer": string,
  "workingSummary": string,
  "keyFormulaOrCode": string|null
}`;

const SHORT_SYSTEM_PROMPT = withJsonSuffix(
  `You are producing an EXAM-ANSWER-KEY entry for a single question — not a tutoring
explanation. A student should be able to write exactly what you return and receive full
marks. Be direct and concise. Do not teach, do not restate the question, do not add
context the marks don't require.

1. finalAnswer: the exact, direct answer. For MCQ, the correct option letter AND its
   text (e.g. "B) O(log n)"). For true/false, "True" or "False" plus, only if marks
   depend on it, one clause of justification. For short-answer/numeric/derivation
   questions, the specific result — not a discussion of the topic.
2. workingSummary: at most 2-3 sentences of the essential working/reasoning a grader
   would want to see for partial-credit purposes — not a full derivation, not a
   step-by-step walkthrough. Empty string if the question needs no shown working
   (e.g. a definitional MCQ).
3. keyFormulaOrCode: ONE formula or a short, complete code snippet if — and only if —
   the question specifically requires writing one to earn the marks. null otherwise.
   Never a multi-function or heavily-commented solution; the minimum that earns marks.

Never include an explanation of underlying concepts, a diagram, a glossary, or
references. This is an answer key entry, not a lesson.`,
  SHORT_SCHEMA
);

function buildShortUserPrompt(input: Record<string, unknown>): string {
  const rawQuestionText = typeof input.questionText === "string" ? input.questionText : "";
  const questionText = scanAndNeutralizeInjection(rawQuestionText).cleanedText;
  const subject = typeof input.subject === "string" ? input.subject : "general";
  const type = typeof input.type === "string" ? input.type : "short_answer";
  const marks = typeof input.marks === "number" ? input.marks : "unspecified";
  const programmingLanguage = typeof input.programmingLanguage === "string" ? input.programmingLanguage : null;

  return `Question: ${questionText}
Subject: ${subject}
Type: ${type}
Marks: ${marks}
Programming language (if applicable): ${programmingLanguage ?? "n/a"}

Produce the exam-answer-key entry per the schema. Be as brief as the marks allow.`;
}

function validateShort(parsed: unknown): parsed is ShortSolutionResponse {
  if (!isPlainObject(parsed)) return false;
  if (typeof parsed.finalAnswer !== "string") return false;
  if (typeof parsed.workingSummary !== "string") return false;
  if (parsed.keyFormulaOrCode !== null && typeof parsed.keyFormulaOrCode !== "string") return false;
  return true;
}

export const shortSolutionPrompt: PromptDefinition<ShortSolutionResponse> = {
  id: "assignment.solution.generate_short",
  feature: "assignment_solution",
  systemPrompt: SHORT_SYSTEM_PROMPT,
  buildUserPrompt: buildShortUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SHORT_SCHEMA,
  temperature: 0.2,
  maxOutputTokens: 600,
  validate: validateShort,
};
