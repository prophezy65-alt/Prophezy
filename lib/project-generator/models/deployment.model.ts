/**
 * lib/project-generator/models/deployment.model.ts
 *
 * Describes how a generated project is deployed: per-target step-by-step
 * guides, required environment variables, and a CI/CD pipeline definition.
 */

import { DeploymentTarget } from "./enums";
import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface EnvironmentVariable {
  readonly key: string;
  readonly description: string;
  readonly required: boolean;
  readonly secret: boolean; // true => must never be committed / logged
  readonly exampleValue: string;
}

export interface DeploymentStep {
  readonly order: number;
  readonly title: string;
  readonly instructions: string;
  readonly command: string | null; // shell command to run, if any
}

export interface DeploymentGuide {
  readonly id: UUID;
  readonly target: DeploymentTarget;
  readonly title: string;
  readonly prerequisites: readonly string[];
  readonly steps: readonly DeploymentStep[];
  readonly environmentVariables: readonly EnvironmentVariable[];
  readonly postDeployChecklist: readonly string[];
}

export interface PipelineJob {
  readonly name: string;
  readonly runsOn: string; // e.g. "ubuntu-latest"
  readonly steps: readonly { readonly name: string; readonly run: string }[];
  readonly triggerBranches: readonly string[];
}

export interface CiCdPipeline {
  readonly provider: "github_actions";
  readonly workflowFileName: string; // e.g. ".github/workflows/ci.yml"
  readonly jobs: readonly PipelineJob[];
}

export interface DeploymentPlan {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly guides: readonly DeploymentGuide[];
  readonly pipeline: CiCdPipeline;
  readonly recommendedTarget: DeploymentTarget;
}

export function findGuide(plan: DeploymentPlan, target: DeploymentTarget): DeploymentGuide | undefined {
  return plan.guides.find((g) => g.target === target);
}

export function getRequiredSecrets(guide: DeploymentGuide): EnvironmentVariable[] {
  return guide.environmentVariables.filter((v) => v.required && v.secret);
}

export function validateDeploymentPlan(plan: DeploymentPlan): string[] {
  const problems: string[] = [];

  if (!isUUID(plan.id)) problems.push("DeploymentPlan.id must be a UUID.");
  if (!isUUID(plan.projectSpecId)) problems.push("DeploymentPlan.projectSpecId must be a UUID.");
  if (plan.guides.length === 0) problems.push("DeploymentPlan.guides must contain at least one guide.");

  const targets = new Set(plan.guides.map((g) => g.target));
  if (!targets.has(plan.recommendedTarget)) {
    problems.push(`recommendedTarget "${plan.recommendedTarget}" has no matching guide.`);
  }

  for (const guide of plan.guides) {
    const orders = guide.steps.map((s) => s.order).sort((a, b) => a - b);
    orders.forEach((order, index) => {
      if (order !== index + 1) {
        problems.push(`Guide "${guide.title}" step ordering is not sequential starting at 1.`);
      }
    });
    if (guide.steps.length === 0) {
      problems.push(`Guide "${guide.title}" defines no steps.`);
    }
  }

  if (!isNonEmptyString(plan.pipeline.workflowFileName)) {
    problems.push("CiCdPipeline.workflowFileName is required.");
  }
  if (plan.pipeline.jobs.length === 0) {
    problems.push("CiCdPipeline.jobs must contain at least one job.");
  }

  return problems;
}
