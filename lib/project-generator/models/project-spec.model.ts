/**
 * lib/project-generator/models/project-spec.model.ts
 *
 * ProjectSpec is the central aggregate of the Project Generator: every
 * other generated artifact (database schema, API design, roadmap,
 * diagrams, README, export bundle) is derived from — and references
 * back to — a single ProjectSpec instance.
 */

import { ProjectDomain, DifficultyLevel, ProjectScale, LicenseType } from "./enums";
import { UUID, ISODateString, ScoreValue, Tag, isNonEmptyString, isUUID } from "./shared.model";

export interface ProjectObjective {
  readonly id: UUID;
  readonly statement: string;
  readonly successCriteria: readonly string[];
}

export interface ProjectScopeItem {
  readonly id: UUID;
  readonly description: string;
  readonly inScope: boolean; // false => explicitly out of scope
}

export interface ProjectFeature {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly userStory: string; // "As a <role>, I want <capability>, so that <benefit>"
  readonly moduleId: UUID;
  readonly isCore: boolean;
}

export interface ProjectModule {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly featureIds: readonly UUID[];
  readonly order: number;
}

export interface FolderNode {
  readonly name: string;
  readonly type: "file" | "directory";
  readonly description: string;
  readonly children: readonly FolderNode[];
}

export interface TechStackChoice {
  readonly category:
    | "language"
    | "framework"
    | "database"
    | "orm"
    | "auth"
    | "styling"
    | "state_management"
    | "hosting"
    | "ci_cd"
    | "testing"
    | "ai_provider"
    | "cache"
    | "queue"
    | "storage"
    | "other";
  readonly name: string;
  readonly version: string;
  readonly rationale: string;
}

export interface ProjectSpec {
  readonly id: UUID;
  readonly generationRequestId: UUID;
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly domains: readonly ProjectDomain[];
  readonly objectives: readonly ProjectObjective[];
  readonly scope: readonly ProjectScopeItem[];
  readonly modules: readonly ProjectModule[];
  readonly features: readonly ProjectFeature[];
  readonly folderStructure: FolderNode;
  readonly techStack: readonly TechStackChoice[];
  readonly difficulty: ScoreValue;
  readonly complexity: ScoreValue;
  readonly scale: ProjectScale;
  readonly targetDifficultyLevel: DifficultyLevel;
  readonly estimatedCostUsd: { readonly min: number; readonly max: number };
  readonly license: LicenseType;
  readonly tags: readonly Tag[];
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/** Lightweight summary used in list views / dashboards, derived from ProjectSpec. */
export interface ProjectSpecSummary {
  readonly id: UUID;
  readonly title: string;
  readonly tagline: string;
  readonly domains: readonly ProjectDomain[];
  readonly difficulty: number;
  readonly complexity: number;
  readonly moduleCount: number;
  readonly featureCount: number;
  readonly createdAt: ISODateString;
}

export function toProjectSpecSummary(spec: ProjectSpec): ProjectSpecSummary {
  return {
    id: spec.id,
    title: spec.title,
    tagline: spec.tagline,
    domains: spec.domains,
    difficulty: spec.difficulty.score,
    complexity: spec.complexity.score,
    moduleCount: spec.modules.length,
    featureCount: spec.features.length,
    createdAt: spec.createdAt,
  };
}

function validateFolderNode(node: FolderNode, path: string, problems: string[]): void {
  if (!isNonEmptyString(node.name)) {
    problems.push(`Folder node at "${path}" is missing a name.`);
  }
  if (node.type === "file" && node.children.length > 0) {
    problems.push(`Folder node "${path}/${node.name}" is a file but has children.`);
  }
  node.children.forEach((child) => validateFolderNode(child, `${path}/${node.name}`, problems));
}

/**
 * Validates internal referential integrity of a ProjectSpec:
 * every feature must point at an existing module, module order must be
 * unique/sequential, and the folder tree must be well-formed.
 */
export function validateProjectSpec(spec: ProjectSpec): string[] {
  const problems: string[] = [];

  if (!isUUID(spec.id)) problems.push("ProjectSpec.id must be a UUID.");
  if (!isUUID(spec.generationRequestId)) problems.push("ProjectSpec.generationRequestId must be a UUID.");
  if (!isNonEmptyString(spec.title)) problems.push("ProjectSpec.title is required.");
  if (!isNonEmptyString(spec.description)) problems.push("ProjectSpec.description is required.");
  if (spec.domains.length === 0) problems.push("ProjectSpec.domains must contain at least one domain.");
  if (spec.modules.length === 0) problems.push("ProjectSpec.modules must contain at least one module.");

  const moduleIds = new Set(spec.modules.map((m) => m.id));
  const seenOrders = new Set<number>();
  for (const mod of spec.modules) {
    if (seenOrders.has(mod.order)) {
      problems.push(`Duplicate module order value ${mod.order} on module "${mod.name}".`);
    }
    seenOrders.add(mod.order);
    for (const featureId of mod.featureIds) {
      if (!spec.features.some((f) => f.id === featureId)) {
        problems.push(`Module "${mod.name}" references missing feature id ${featureId}.`);
      }
    }
  }

  for (const feature of spec.features) {
    if (!moduleIds.has(feature.moduleId)) {
      problems.push(`Feature "${feature.name}" references missing module id ${feature.moduleId}.`);
    }
  }

  if (spec.estimatedCostUsd.min < 0 || spec.estimatedCostUsd.max < spec.estimatedCostUsd.min) {
    problems.push("ProjectSpec.estimatedCostUsd must satisfy 0 <= min <= max.");
  }

  if (spec.difficulty.score < 0 || spec.difficulty.score > 100) {
    problems.push("ProjectSpec.difficulty.score must be within 0-100.");
  }
  if (spec.complexity.score < 0 || spec.complexity.score > 100) {
    problems.push("ProjectSpec.complexity.score must be within 0-100.");
  }

  validateFolderNode(spec.folderStructure, "", problems);

  return problems;
}
