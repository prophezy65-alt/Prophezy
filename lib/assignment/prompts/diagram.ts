// lib/assignment/prompts/diagram.ts
import { PromptDefinition, withJsonSuffix, isPlainObject } from "./_shared";

export interface DiagramResponse {
  mermaidCode: string;
  diagramType: "flowchart" | "sequence" | "class" | "state" | "er" | "mindmap" | "gantt";
  title: string;
  isApplicable: boolean;
  reasonIfNotApplicable: string | null;
}

const SCHEMA = `{
  "mermaidCode": string,
  "diagramType": "flowchart"|"sequence"|"class"|"state"|"er"|"mindmap"|"gantt",
  "title": string,
  "isApplicable": boolean,
  "reasonIfNotApplicable": string|null
}`;

const SYSTEM_PROMPT = withJsonSuffix(
  `You generate a single, standalone Mermaid diagram to visually explain a topic,
process, algorithm, or system — used when a student explicitly requests a visual aid
(distinct from diagrams auto-embedded in a solution).

Pick the most appropriate diagramType for the content:
- flowchart: processes, algorithms, decision logic
- sequence: interactions between actors/systems over time
- class: object-oriented structure, database entity relationships (or use "er" for pure
  DB schemas)
- state: state machines, lifecycle transitions
- mindmap: concept hierarchies / brainstorm-style topic breakdowns
- gantt: project timelines / scheduling

The mermaidCode must be syntactically valid Mermaid and render without errors.

If the requested topic genuinely does NOT lend itself to a diagram (e.g. an abstract
philosophical question with no structural/process/relational shape), set isApplicable
to false, explain why in reasonIfNotApplicable, and return an empty string for
mermaidCode. Do not force a diagram onto content that doesn't have real visual structure.`,
  SCHEMA
);

function buildUserPrompt(input: Record<string, unknown>): string {
  const topic = typeof input.topic === "string" ? input.topic : "";
  const context = typeof input.context === "string" ? input.context : "";
  const preferredType = typeof input.preferredType === "string" ? input.preferredType : "auto";
  return `Topic: ${topic}\n\nContext:\n${context}\n\nPreferred diagram type: ${preferredType} (use "auto" to let you choose the best fit).`;
}

const VALID_TYPES = ["flowchart", "sequence", "class", "state", "er", "mindmap", "gantt"];

function validate(parsed: unknown): parsed is DiagramResponse {
  if (!isPlainObject(parsed)) return false;
  if (typeof parsed.mermaidCode !== "string") return false;
  if (!VALID_TYPES.includes(parsed.diagramType as string)) return false;
  if (typeof parsed.title !== "string") return false;
  if (typeof parsed.isApplicable !== "boolean") return false;
  if (parsed.reasonIfNotApplicable !== null && typeof parsed.reasonIfNotApplicable !== "string") return false;
  return true;
}

export const diagramPrompt: PromptDefinition<DiagramResponse> = {
  id: "assignment.diagram.generate",
  feature: "assignment_diagram",
  systemPrompt: SYSTEM_PROMPT,
  buildUserPrompt,
  jsonMode: true,
  responseSchemaDescription: SCHEMA,
  temperature: 0.25,
  maxOutputTokens: 3072,
  validate,
};
