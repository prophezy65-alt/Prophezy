/**
 * lib/project-generator/services/deployment.service.ts
 *
 * Generates a `DeploymentPlan`: step-by-step guides for every requested
 * deployment target (Vercel, Railway, Render, Docker, AWS, Azure, Google
 * Cloud, Supabase), required environment variables, and a GitHub Actions
 * CI/CD pipeline — derived from a `ProjectSpec` via the AI Core.
 */

import {
  DeploymentPlan,
  DeploymentTarget,
  ProjectSpec,
  Result,
  GenerationError,
  ok,
  err,
  validateDeploymentPlan,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, coerceEnum, coerceBoolean, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.deployment";
const CACHE_TTL_SECONDS = 60 * 60;

const DEPLOYMENT_TARGET_VALUES = Object.values(DeploymentTarget);

interface RawEnvVar {
  readonly key: string;
  readonly description: string;
  readonly required: boolean;
  readonly secret: boolean;
  readonly exampleValue: string;
}

interface RawStep {
  readonly order: number;
  readonly title: string;
  readonly instructions: string;
  readonly command: string | null;
}

interface RawGuide {
  readonly target: string;
  readonly title: string;
  readonly prerequisites: readonly string[];
  readonly steps: readonly RawStep[];
  readonly environmentVariables: readonly RawEnvVar[];
  readonly postDeployChecklist: readonly string[];
}

interface RawPipelineJob {
  readonly name: string;
  readonly runsOn: string;
  readonly steps: readonly { readonly name: string; readonly run: string }[];
  readonly triggerBranches: readonly string[];
}

interface RawDeploymentResponse {
  readonly guides: readonly RawGuide[];
  readonly recommendedTarget: string;
  readonly workflowFileName: string;
  readonly pipelineJobs: readonly RawPipelineJob[];
}

function parseEnvVar(raw: unknown, path: string): RawEnvVar {
  const v = assertObject(raw, path);
  return {
    key: assertString(v.key, `${path}.key`),
    description: coerceString(v.description, "No description provided."),
    required: coerceBoolean(v.required, true),
    secret: coerceBoolean(v.secret, true),
    // exampleValue is illustrative detail on a real env var (key is its
    // identity) — default rather than fail the whole plan over it.
    exampleValue: coerceString(v.exampleValue, ""),
  };
}

function parseStep(raw: unknown, path: string, index: number): RawStep {
  const s = assertObject(raw, path);
  // "order" is positional bookkeeping (must be sequential starting at 1
  // per buildSystemPrompt, and validateDeploymentPlan enforces exactly
  // that) — same rationale as phase.order in roadmap.service.ts, so
  // derive it from array position when omitted. This also guarantees the
  // sequential-order check downstream always passes for AI-omitted orders.
  const order = typeof s.order === "number" && Number.isFinite(s.order) ? s.order : index + 1;
  return {
    order,
    title: assertString(s.title, `${path}.title`),
    instructions: assertString(s.instructions, `${path}.instructions`),
    command: s.command === null || s.command === undefined ? null : assertString(s.command, `${path}.command`),
  };
}

function parseGuide(raw: unknown, path: string): RawGuide {
  const g = assertObject(raw, path);
  return {
    // target is normalized through coerceEnum downstream.
    target: coerceString(g.target, ""),
    title: assertString(g.title, `${path}.title`),
    prerequisites: assertArray(g.prerequisites ?? [], `${path}.prerequisites`).map((p, i) => assertString(p, `${path}.prerequisites[${i}]`)),
    // An empty steps array is a real, surfaced problem — validateDeploymentPlan
    // already flags "defines no steps" as a semantic issue fed back through
    // the corrective-retry loop, rather than a raw-parse crash.
    steps: assertArray(g.steps ?? [], `${path}.steps`).map((s, i) => parseStep(s, `${path}.steps[${i}]`, i)),
    environmentVariables: assertArray(g.environmentVariables ?? [], `${path}.environmentVariables`).map((v, i) =>
      parseEnvVar(v, `${path}.environmentVariables[${i}]`)
    ),
    postDeployChecklist: assertArray(g.postDeployChecklist ?? [], `${path}.postDeployChecklist`).map((c, i) =>
      assertString(c, `${path}.postDeployChecklist[${i}]`)
    ),
  };
}

function parsePipelineJob(raw: unknown, path: string): RawPipelineJob {
  const j = assertObject(raw, path);
  return {
    name: assertString(j.name, `${path}.name`),
    runsOn: coerceString(j.runsOn, "ubuntu-latest"),
    steps: assertArray(j.steps ?? [], `${path}.steps`).map((s, i) => {
      const step = assertObject(s, `${path}.steps[${i}]`);
      return { name: assertString(step.name, `${path}.steps[${i}].name`), run: assertString(step.run, `${path}.steps[${i}].run`) };
    }),
    triggerBranches: assertArray(j.triggerBranches ?? ["main"], `${path}.triggerBranches`).map((b, i) =>
      assertString(b, `${path}.triggerBranches[${i}]`)
    ),
  };
}

function parseRawDeploymentResponse(raw: unknown): RawDeploymentResponse {
  const r = assertObject(raw, "$");
  const guides = assertArray(r.guides, "guides").map((g, i) => parseGuide(g, `guides[${i}]`));
  if (guides.length === 0) throw new Error("guides must contain at least one entry.");
  return {
    guides,
    // recommendedTarget is normalized through coerceEnum downstream.
    recommendedTarget: coerceString(r.recommendedTarget, ""),
    workflowFileName: coerceString(r.workflowFileName, "deploy.yml"),
    // An empty pipelineJobs array is a real, surfaced problem —
    // validateDeploymentPlan already flags "jobs must contain at least one
    // job" as a semantic issue fed back through the corrective-retry loop.
    pipelineJobs: assertArray(r.pipelineJobs ?? [], "pipelineJobs").map((j, i) => parsePipelineJob(j, `pipelineJobs[${i}]`)),
  };
}

function buildSystemPrompt(requestedTargets: readonly DeploymentTarget[]): string {
  return [
    "You are the Deployment Plan generator inside Prophezy's Project Generator.",
    "Given a ProjectSpec, produce a step-by-step deployment guide for EACH of the following targets:",
    requestedTargets.map((t) => `- ${t}`).join("\n"),
    "plus a GitHub Actions CI/CD pipeline.",
    "",
    "Rules:",
    "- steps[].order must be sequential starting at 1 with no gaps.",
    "- Mark any environment variable holding a credential/secret with secret=true.",
    "- recommendedTarget must be one of the targets you produced a guide for.",
    "- pipelineJobs must include at least a build/lint/test job.",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "guides": [...], "recommendedTarget": string, "workflowFileName": string, "pipelineJobs": [...] }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec): string {
  return [
    `Project: ${spec.title}`,
    spec.description,
    "",
    `Tech stack: ${spec.techStack.map((t) => `${t.name} (${t.category})`).join(", ")}.`,
    `Scale: ${spec.scale}.`,
  ].join("\n");
}

export async function generateDeploymentPlan(
  spec: ProjectSpec,
  context: ServiceContext,
  requestedTargets: readonly DeploymentTarget[] = [
    DeploymentTarget.VERCEL,
    DeploymentTarget.DOCKER,
    DeploymentTarget.SUPABASE,
  ]
): Promise<Result<DeploymentPlan, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<DeploymentPlan>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(requestedTargets),
    userPrompt: buildUserPrompt(spec),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    parse: (raw) => {
      const parsed = parseRawDeploymentResponse(raw);
      const plan: DeploymentPlan = {
        id: context.ids.newId(),
        projectSpecId: spec.id,
        guides: parsed.guides.map((g) => ({
          id: context.ids.newId(),
          target: coerceEnum(g.target, DEPLOYMENT_TARGET_VALUES, DeploymentTarget.VERCEL),
          title: g.title,
          prerequisites: g.prerequisites,
          steps: [...g.steps].sort((a, b) => a.order - b.order),
          environmentVariables: g.environmentVariables.map((v) => ({ ...v })),
          postDeployChecklist: g.postDeployChecklist,
        })),
        pipeline: {
          provider: "github_actions",
          workflowFileName: parsed.workflowFileName,
          jobs: parsed.pipelineJobs.map((j) => ({ ...j })),
        },
        recommendedTarget: coerceEnum(parsed.recommendedTarget, DEPLOYMENT_TARGET_VALUES, DeploymentTarget.VERCEL),
      };

      // Validate INSIDE parse so a semantically-invalid plan throws here
      // and is caught by ai-core-client's corrective-retry loop instead of
      // being a terminal, unrecoverable failure.
      const problems = validateDeploymentPlan(plan);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return plan;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = validateDeploymentPlan(aiResult.value);
  if (problems.length > 0) {
    context.logger.error("generateDeploymentPlan: validation failed", { problems });
    return err(validationFailedError("generateDeploymentPlan", problems));
  }

  context.logger.info("generateDeploymentPlan: succeeded", { projectSpecId: spec.id, guideCount: aiResult.value.guides.length });
  return ok(aiResult.value);
}
