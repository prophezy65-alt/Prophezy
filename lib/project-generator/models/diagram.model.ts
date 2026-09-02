/**
 * lib/project-generator/models/diagram.model.ts
 *
 * Describes generated diagrams. Source of truth is always Mermaid syntax
 * (`mermaidSource`) since it is text, diffable, renderable in most modern
 * Markdown viewers, and trivially exportable to SVG/PNG by the export/
 * module — no binary diagram formats are modeled here.
 */

import { DiagramType } from "./enums";
import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface DiagramNode {
  readonly id: string;
  readonly label: string;
}

export interface DiagramEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly label: string | null;
}

export interface Diagram {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly type: DiagramType;
  readonly title: string;
  readonly description: string;
  /** Canonical Mermaid source. Always the rendering source of truth. */
  readonly mermaidSource: string;
  /** Structured graph representation, kept in sync with mermaidSource for programmatic use (e.g. layout, search). */
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
}

const MERMAID_DIRECTIVE_BY_TYPE: Record<DiagramType, string> = {
  [DiagramType.FLOWCHART]: "flowchart TD",
  [DiagramType.MERMAID_ER]: "erDiagram",
  [DiagramType.CLASS_DIAGRAM]: "classDiagram",
  [DiagramType.SEQUENCE_DIAGRAM]: "sequenceDiagram",
  [DiagramType.USE_CASE_DIAGRAM]: "flowchart LR",
  [DiagramType.SYSTEM_ARCHITECTURE]: "flowchart TD",
  [DiagramType.DATABASE_DIAGRAM]: "erDiagram",
  [DiagramType.FOLDER_DIAGRAM]: "flowchart TD",
};

export function expectedMermaidDirective(type: DiagramType): string {
  return MERMAID_DIRECTIVE_BY_TYPE[type];
}

export function findNode(diagram: Diagram, nodeId: string): DiagramNode | undefined {
  return diagram.nodes.find((n) => n.id === nodeId);
}

/**
 * Validates that: the Mermaid source opens with the directive expected
 * for the diagram's declared type, every edge references nodes that
 * actually exist, and node ids are unique.
 */
export function validateDiagram(diagram: Diagram): string[] {
  const problems: string[] = [];

  if (!isUUID(diagram.id)) problems.push("Diagram.id must be a UUID.");
  if (!isUUID(diagram.projectSpecId)) problems.push("Diagram.projectSpecId must be a UUID.");
  if (!isNonEmptyString(diagram.title)) problems.push("Diagram.title is required.");
  if (!isNonEmptyString(diagram.mermaidSource)) problems.push("Diagram.mermaidSource is required.");

  const expectedDirective = expectedMermaidDirective(diagram.type);
  const trimmedSource = diagram.mermaidSource.trim();
  if (!trimmedSource.startsWith(expectedDirective)) {
    problems.push(
      `Diagram type "${diagram.type}" expects Mermaid source to start with "${expectedDirective}".`
    );
  }

  const nodeIds = new Set<string>();
  for (const node of diagram.nodes) {
    if (nodeIds.has(node.id)) {
      problems.push(`Duplicate diagram node id "${node.id}".`);
    }
    nodeIds.add(node.id);
  }

  for (const edge of diagram.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      problems.push(`Diagram edge references missing fromNodeId "${edge.fromNodeId}".`);
    }
    if (!nodeIds.has(edge.toNodeId)) {
      problems.push(`Diagram edge references missing toNodeId "${edge.toNodeId}".`);
    }
  }

  return problems;
}

/** A named collection of every diagram generated for one ProjectSpec. */
export interface DiagramSet {
  readonly projectSpecId: UUID;
  readonly diagrams: readonly Diagram[];
}

export function getDiagramByType(set: DiagramSet, type: DiagramType): Diagram | undefined {
  return set.diagrams.find((d) => d.type === type);
}
