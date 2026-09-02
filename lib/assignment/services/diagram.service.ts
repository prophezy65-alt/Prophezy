// lib/assignment/services/diagram.service.ts
import { diagramPrompt } from "../prompts/diagram";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";

export interface GenerateDiagramOptions {
  userId: string;
  preferredType?: "flowchart" | "sequence" | "class" | "state" | "er" | "mindmap" | "gantt" | "auto";
}

export interface DiagramResult {
  mermaidCode: string;
  diagramType: string;
  title: string;
  isApplicable: boolean;
  reasonIfNotApplicable: string | null;
  syntaxWarnings: string[];
}

export async function generateDiagram(
  topic: string,
  context: string,
  options: GenerateDiagramOptions
): Promise<DiagramResult> {
  const result = await runAssignmentPrompt(
    diagramPrompt,
    { topic, context, preferredType: options.preferredType ?? "auto" },
    { userId: options.userId }
  );

  const syntaxWarnings = result.isApplicable ? lintMermaidSyntax(result.mermaidCode, result.diagramType) : [];

  return {
    mermaidCode: result.mermaidCode,
    diagramType: result.diagramType,
    title: result.title,
    isApplicable: result.isApplicable,
    reasonIfNotApplicable: result.reasonIfNotApplicable,
    syntaxWarnings,
  };
}

const DIAGRAM_KEYWORD: Record<string, string> = {
  flowchart: "flowchart",
  sequence: "sequenceDiagram",
  class: "classDiagram",
  state: "stateDiagram",
  er: "erDiagram",
  mindmap: "mindmap",
  gantt: "gantt",
};

/** Cheap, dependency-free sanity check that the generated Mermaid code at
 * least opens with the expected diagram-type keyword and has balanced
 * brackets — catches the most common AI slip-ups (wrong keyword, unclosed
 * subgraph) before the frontend tries to render it. Not a full Mermaid
 * parser; the frontend's mermaid.js render call remains the final check. */
function lintMermaidSyntax(code: string, diagramType: string): string[] {
  const warnings: string[] = [];
  const expectedKeyword = DIAGRAM_KEYWORD[diagramType];

  if (expectedKeyword && !code.trim().toLowerCase().startsWith(expectedKeyword.toLowerCase())) {
    warnings.push(`Expected diagram to start with "${expectedKeyword}" for type "${diagramType}"`);
  }

  const openBrackets = (code.match(/[[({]/g) ?? []).length;
  const closeBrackets = (code.match(/[\])}]/g) ?? []).length;
  if (openBrackets !== closeBrackets) {
    warnings.push(`Unbalanced brackets: ${openBrackets} opening vs ${closeBrackets} closing`);
  }

  const subgraphOpens = (code.match(/\bsubgraph\b/gi) ?? []).length;
  const subgraphCloses = (code.match(/\bend\b/gi) ?? []).length;
  if (subgraphOpens > subgraphCloses) {
    warnings.push(`${subgraphOpens} "subgraph" block(s) but only ${subgraphCloses} "end" statement(s)`);
  }

  return warnings;
}
