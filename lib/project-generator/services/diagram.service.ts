/**
 * lib/project-generator/services/diagram.service.ts
 *
 * Generates the full set of diagrams for a `ProjectSpec` + `DatabaseSchema`:
 * flowchart, ER, class, sequence, use case, system architecture, database,
 * and folder diagrams — each backed by Mermaid source (the rendering
 * source of truth per `models/diagram.model.ts`).
 */

import {
  DatabaseSchema,
  Diagram,
  DiagramSet,
  DiagramType,
  ProjectSpec,
  Result,
  GenerationError,
  ok,
  err,
  validateDiagram,
  expectedMermaidDirective,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, coerceEnum, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.diagrams";
const CACHE_TTL_SECONDS = 60 * 60;

const DIAGRAM_TYPE_VALUES = Object.values(DiagramType);

interface RawDiagramNode {
  readonly id: string;
  readonly label: string;
}

interface RawDiagramEdge {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly label: string | null;
}

interface RawDiagram {
  readonly type: string;
  readonly title: string;
  readonly description: string;
  readonly mermaidSource: string;
  readonly nodes: readonly RawDiagramNode[];
  readonly edges: readonly RawDiagramEdge[];
}

function parseNode(raw: unknown, path: string): RawDiagramNode {
  const n = assertObject(raw, path);
  return { id: assertString(n.id, `${path}.id`), label: assertString(n.label, `${path}.label`) };
}

function parseEdge(raw: unknown, path: string): RawDiagramEdge {
  const e = assertObject(raw, path);
  return {
    fromNodeId: assertString(e.fromNodeId, `${path}.fromNodeId`),
    toNodeId: assertString(e.toNodeId, `${path}.toNodeId`),
    label: e.label === null || e.label === undefined ? null : assertString(e.label, `${path}.label`),
  };
}

/**
 * Returns null when a diagram is missing its Mermaid source — an empty
 * diagram body isn't a diagram, and there's no honest source to invent, so
 * this one diagram is dropped rather than failing the whole set (same
 * rationale as tryParseForeignKey in database-schema.service.ts). The
 * other requested diagram types are unaffected.
 */
function tryParseDiagram(raw: unknown, path: string): RawDiagram | null {
  const d = assertObject(raw, path);
  const mermaidSource = typeof d.mermaidSource === "string" && d.mermaidSource.trim().length > 0 ? d.mermaidSource : null;
  if (!mermaidSource) return null;
  return {
    // type is normalized through coerceEnum downstream.
    type: coerceString(d.type, ""),
    title: coerceString(d.title, "Diagram"),
    description: coerceString(d.description, "No description provided."),
    mermaidSource,
    nodes: assertArray(d.nodes ?? [], `${path}.nodes`).map((n, i) => parseNode(n, `${path}.nodes[${i}]`)),
    edges: assertArray(d.edges ?? [], `${path}.edges`).map((e, i) => parseEdge(e, `${path}.edges[${i}]`)),
  };
}

function parseRawDiagramsResponse(raw: unknown): readonly RawDiagram[] {
  const r = assertObject(raw, "$");
  const diagrams = assertArray(r.diagrams, "diagrams")
    .map((d, i) => tryParseDiagram(d, `diagrams[${i}]`))
    .filter((d): d is RawDiagram => d !== null);
  if (diagrams.length === 0) throw new Error("diagrams must contain at least one entry with a valid mermaidSource.");
  return diagrams;
}

function buildSystemPrompt(requestedTypes: readonly DiagramType[]): string {
  const directiveHints = requestedTypes
    .map((t) => `  - "${t}" -> Mermaid source MUST start with "${expectedMermaidDirective(t)}"`)
    .join("\n");

  return [
    "You are the Diagram generator inside Prophezy's Project Generator.",
    "Given a ProjectSpec and DatabaseSchema, produce one Mermaid diagram for EACH of the following diagram types:",
    requestedTypes.map((t) => `- ${t}`).join("\n"),
    "",
    "Rules:",
    "- Each diagram's mermaidSource must be valid Mermaid syntax and start with the directive required for its type:",
    directiveHints,
    "- Every edge's fromNodeId/toNodeId MUST reference a node id declared in that same diagram's nodes array.",
    "- Keep each diagram focused and readable (roughly 8-20 nodes) rather than exhaustively cataloguing every entity.",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "diagrams": [{ "type": string, "title": string, "description": string, "mermaidSource": string,',
    '   "nodes": [{ "id": string, "label": string }], "edges": [{ "fromNodeId": string, "toNodeId": string, "label": string|null }] }] }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec, schema: DatabaseSchema): string {
  return [
    `Project: ${spec.title}`,
    spec.description,
    "",
    `Modules: ${spec.modules.map((m) => m.name).join(", ")}`,
    `Tables: ${schema.tables.map((t) => t.name).join(", ")}`,
    `Folder structure root: ${spec.folderStructure.name}`,
  ].join("\n");
}

export async function generateDiagrams(
  spec: ProjectSpec,
  schema: DatabaseSchema,
  context: ServiceContext,
  requestedTypes: readonly DiagramType[] = DIAGRAM_TYPE_VALUES
): Promise<Result<DiagramSet, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<DiagramSet>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(requestedTypes),
    userPrompt: buildUserPrompt(spec, schema),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    // Up to 8 full diagrams (each with its own Mermaid source + nodes/edges)
    // in one response is likely the largest payload in the whole pipeline.
    maxOutputTokens: 24576,
    parse: (raw) => {
      const parsed = parseRawDiagramsResponse(raw);
      const diagrams: Diagram[] = parsed.map((d) => ({
        id: context.ids.newId(),
        projectSpecId: spec.id,
        type: coerceEnum(d.type, DIAGRAM_TYPE_VALUES, DiagramType.FLOWCHART),
        title: d.title,
        description: d.description,
        mermaidSource: d.mermaidSource.trim(),
        nodes: d.nodes,
        edges: d.edges,
      }));
      const diagramSet = { projectSpecId: spec.id, diagrams };

      // Validate INSIDE parse so a semantically-invalid diagram throws here
      // and is caught by ai-core-client's corrective-retry loop instead of
      // being a terminal, unrecoverable failure.
      const problems = diagrams.flatMap((d) => validateDiagram(d));
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return diagramSet;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = aiResult.value.diagrams.flatMap((d) => validateDiagram(d));
  if (problems.length > 0) {
    context.logger.error("generateDiagrams: validation failed", { problems });
    return err(validationFailedError("generateDiagrams", problems));
  }

  context.logger.info("generateDiagrams: succeeded", {
    projectSpecId: spec.id,
    diagramCount: aiResult.value.diagrams.length,
  });
  return ok(aiResult.value);
}
