/**
 * lib/project-generator/models/generation-result.model.ts
 *
 * The top-level aggregate returned to callers once a generation run
 * completes: every artifact produced for a single GenerationRequest,
 * plus status/progress tracking while it's still in flight.
 */

import { GenerationStatus } from "./enums";
import { UUID, ISODateString, GenerationError, GenerationMetadata, isUUID } from "./shared.model";
import { ProjectSpec, validateProjectSpec } from "./project-spec.model";
import { DatabaseSchema, validateDatabaseSchema } from "./database-schema.model";
import { ApiDesign, validateApiDesign } from "./api-design.model";
import { Roadmap, validateRoadmap } from "./roadmap.model";
import { DiagramSet } from "./diagram.model";
import { DeploymentPlan, validateDeploymentPlan } from "./deployment.model";
import { TestingPlan, validateTestingPlan } from "./testing.model";
import { SecurityPlan, validateSecurityPlan } from "./security.model";
import { ProjectEstimation, validateProjectEstimation } from "./estimation.model";
import { ExportBundle, validateExportBundle } from "./export.model";

/** One entry in the progress trail shown to the user while generation runs. */
export interface GenerationProgressEvent {
  readonly status: GenerationStatus;
  readonly message: string;
  readonly occurredAt: ISODateString;
  readonly percentComplete: number; // 0-100
}

/**
 * The complete set of artifacts produced by one generation run.
 * Each field is nullable because a run in progress (or one that failed
 * partway through) will not have every artifact populated yet.
 */
export interface GenerationResult {
  readonly id: UUID;
  readonly generationRequestId: UUID;
  readonly status: GenerationStatus;
  readonly metadata: GenerationMetadata;
  readonly progress: readonly GenerationProgressEvent[];
  readonly error: GenerationError | null;

  readonly projectSpec: ProjectSpec | null;
  readonly databaseSchema: DatabaseSchema | null;
  readonly apiDesign: ApiDesign | null;
  readonly roadmap: Roadmap | null;
  readonly diagrams: DiagramSet | null;
  readonly deploymentPlan: DeploymentPlan | null;
  readonly testingPlan: TestingPlan | null;
  readonly securityPlan: SecurityPlan | null;
  readonly estimation: ProjectEstimation | null;
  readonly exportBundle: ExportBundle | null;
}

export function isGenerationComplete(result: GenerationResult): boolean {
  return result.status === GenerationStatus.COMPLETED;
}

export function isGenerationFailed(result: GenerationResult): boolean {
  return result.status === GenerationStatus.FAILED;
}

export function latestProgressEvent(result: GenerationResult): GenerationProgressEvent | null {
  if (result.progress.length === 0) return null;
  return result.progress[result.progress.length - 1] ?? null;
}

/**
 * Cross-artifact validation: in addition to each artifact validating
 * itself, this confirms every artifact that references a ProjectSpec
 * actually references *this* result's ProjectSpec, preventing
 * accidental cross-generation contamination.
 */
export function validateGenerationResult(result: GenerationResult): string[] {
  const problems: string[] = [];

  if (!isUUID(result.id)) problems.push("GenerationResult.id must be a UUID.");
  if (!isUUID(result.generationRequestId)) problems.push("GenerationResult.generationRequestId must be a UUID.");

  if (result.status === GenerationStatus.COMPLETED) {
    if (!result.projectSpec) problems.push("Completed GenerationResult is missing projectSpec.");
    if (!result.exportBundle) problems.push("Completed GenerationResult is missing exportBundle.");
  }

  if (result.status === GenerationStatus.FAILED && !result.error) {
    problems.push("Failed GenerationResult must include an error.");
  }

  const specId = result.projectSpec?.id ?? null;

  if (result.projectSpec) problems.push(...validateProjectSpec(result.projectSpec).map((p) => `projectSpec: ${p}`));

  if (result.databaseSchema) {
    problems.push(...validateDatabaseSchema(result.databaseSchema).map((p) => `databaseSchema: ${p}`));
    if (specId && result.databaseSchema.projectSpecId !== specId) {
      problems.push("databaseSchema.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.apiDesign) {
    problems.push(...validateApiDesign(result.apiDesign).map((p) => `apiDesign: ${p}`));
    if (specId && result.apiDesign.projectSpecId !== specId) {
      problems.push("apiDesign.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.roadmap) {
    problems.push(...validateRoadmap(result.roadmap).map((p) => `roadmap: ${p}`));
    if (specId && result.roadmap.projectSpecId !== specId) {
      problems.push("roadmap.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.diagrams && specId && result.diagrams.projectSpecId !== specId) {
    problems.push("diagrams.projectSpecId does not match projectSpec.id.");
  }

  if (result.deploymentPlan) {
    problems.push(...validateDeploymentPlan(result.deploymentPlan).map((p) => `deploymentPlan: ${p}`));
    if (specId && result.deploymentPlan.projectSpecId !== specId) {
      problems.push("deploymentPlan.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.testingPlan) {
    problems.push(...validateTestingPlan(result.testingPlan).map((p) => `testingPlan: ${p}`));
    if (specId && result.testingPlan.projectSpecId !== specId) {
      problems.push("testingPlan.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.securityPlan) {
    problems.push(...validateSecurityPlan(result.securityPlan).map((p) => `securityPlan: ${p}`));
    if (specId && result.securityPlan.projectSpecId !== specId) {
      problems.push("securityPlan.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.estimation) {
    problems.push(...validateProjectEstimation(result.estimation).map((p) => `estimation: ${p}`));
    if (specId && result.estimation.projectSpecId !== specId) {
      problems.push("estimation.projectSpecId does not match projectSpec.id.");
    }
  }

  if (result.exportBundle) {
    problems.push(...validateExportBundle(result.exportBundle).map((p) => `exportBundle: ${p}`));
    if (specId && result.exportBundle.projectSpecId !== specId) {
      problems.push("exportBundle.projectSpecId does not match projectSpec.id.");
    }
  }

  return problems;
}
