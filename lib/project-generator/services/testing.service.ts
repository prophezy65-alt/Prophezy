/**
 * lib/project-generator/services/testing.service.ts
 *
 * Generates a `TestingPlan` (test suites and individual test cases across
 * unit/integration/API/edge-case/e2e) from a `ProjectSpec` and `ApiDesign`
 * via the AI Core.
 */

import {
  ApiDesign,
  ProjectSpec,
  Result,
  GenerationError,
  ok,
  err,
  TestType,
  TestingPlan,
  validateTestingPlan,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, coerceEnum, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.testing";
const CACHE_TTL_SECONDS = 60 * 60;

const TEST_TYPE_VALUES = Object.values(TestType);

interface RawAssertion {
  readonly description: string;
  readonly expected: string;
}

interface RawTestCase {
  readonly type: string;
  readonly title: string;
  readonly targetRef: string;
  readonly setup: readonly string[];
  readonly steps: readonly string[];
  readonly assertions: readonly RawAssertion[];
  readonly isEdgeCase: boolean;
}

interface RawSuite {
  readonly name: string;
  readonly filePath: string;
  readonly testCases: readonly RawTestCase[];
}

interface RawTestingPlanResponse {
  readonly suites: readonly RawSuite[];
  readonly coverageTargetPercent: number;
  readonly testRunnerCommand: string;
}

function parseAssertion(raw: unknown, path: string): RawAssertion {
  const a = assertObject(raw, path);
  return { description: coerceString(a.description, "No description provided."), expected: coerceString(a.expected, "No expected outcome provided.") };
}

function parseTestCase(raw: unknown, path: string): RawTestCase {
  const t = assertObject(raw, path);
  return {
    // type is normalized through coerceEnum downstream.
    type: coerceString(t.type, ""),
    title: coerceString(t.title, "Untitled test case"),
    targetRef: coerceString(t.targetRef, ""),
    setup: assertArray(t.setup ?? [], `${path}.setup`).map((s, i) => assertString(s, `${path}.setup[${i}]`)),
    steps: assertArray(t.steps ?? [], `${path}.steps`).map((s, i) => assertString(s, `${path}.steps[${i}]`)),
    // An empty assertions array is a real, surfaced problem —
    // validateTestingPlan already flags "defines no assertions" as a
    // semantic issue fed back through the corrective-retry loop, which is
    // more useful than a raw-parse crash that only reports the first
    // missing array it happens to hit.
    assertions: assertArray(t.assertions ?? [], `${path}.assertions`).map((a, i) => parseAssertion(a, `${path}.assertions[${i}]`)),
    isEdgeCase: Boolean(t.isEdgeCase),
  };
}

function parseSuite(raw: unknown, path: string): RawSuite {
  const s = assertObject(raw, path);
  return {
    name: assertString(s.name, `${path}.name`),
    filePath: assertString(s.filePath, `${path}.filePath`),
    // An empty testCases array is likewise surfaced by validateTestingPlan
    // ("defines no test cases") rather than crashing the raw parse.
    testCases: assertArray(s.testCases ?? [], `${path}.testCases`).map((t, i) => parseTestCase(t, `${path}.testCases[${i}]`)),
  };
}

function parseRawTestingPlanResponse(raw: unknown): RawTestingPlanResponse {
  const r = assertObject(raw, "$");
  const suites = assertArray(r.suites, "suites").map((s, i) => parseSuite(s, `suites[${i}]`));
  if (suites.length === 0) throw new Error("suites must contain at least one entry.");
  return {
    suites,
    // Config defaults, not claims about the actual project.
    coverageTargetPercent:
      typeof r.coverageTargetPercent === "number" && Number.isFinite(r.coverageTargetPercent) ? r.coverageTargetPercent : 80,
    testRunnerCommand: coerceString(r.testRunnerCommand, "npm test"),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the Testing Plan generator inside Prophezy's Project Generator.",
    "Given a ProjectSpec and its ApiDesign, produce test suites covering unit, integration, API and edge-case tests.",
    "",
    "Rules:",
    "- test type MUST be one of: " + TEST_TYPE_VALUES.join(", ") + ".",
    "- Every test case needs at least one assertion.",
    "- Set isEdgeCase=true only when type is \"edge_case\".",
    "- Cover at least: happy path, validation failure, auth failure (401/403), and not-found (404) for the core endpoints.",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "suites": [{ "name": string, "filePath": string, "testCases": [...] }],',
    '  "coverageTargetPercent": number, "testRunnerCommand": string }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec, design: ApiDesign): string {
  const endpointList = design.resources
    .flatMap((r) => r.endpoints.map((e) => `${e.method} ${e.path} — ${e.summary}`))
    .join("\n");

  return [`Project: ${spec.title}`, spec.description, "", "Endpoints:", endpointList].join("\n");
}

export async function generateTestingPlan(
  spec: ProjectSpec,
  design: ApiDesign,
  context: ServiceContext
): Promise<Result<TestingPlan, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<TestingPlan>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(spec, design),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    parse: (raw) => {
      const parsed = parseRawTestingPlanResponse(raw);
      const plan: TestingPlan = {
        id: context.ids.newId(),
        projectSpecId: spec.id,
        suites: parsed.suites.map((s) => ({
          id: context.ids.newId(),
          name: s.name,
          filePath: s.filePath,
          testCases: s.testCases.map((t) => ({
            id: context.ids.newId(),
            type: coerceEnum(t.type, TEST_TYPE_VALUES, TestType.UNIT),
            title: t.title,
            targetRef: t.targetRef,
            setup: t.setup,
            steps: t.steps,
            assertions: t.assertions.map((a) => ({ ...a })),
            isEdgeCase: t.isEdgeCase,
          })),
        })),
        coverageTargetPercent: Math.min(100, Math.max(0, Math.round(parsed.coverageTargetPercent))),
        testRunnerCommand: parsed.testRunnerCommand,
      };

      // Validate INSIDE parse so a semantically-invalid plan throws here
      // and is caught by ai-core-client's corrective-retry loop instead of
      // being a terminal, unrecoverable failure.
      const problems = validateTestingPlan(plan);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return plan;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = validateTestingPlan(aiResult.value);
  if (problems.length > 0) {
    context.logger.error("generateTestingPlan: validation failed", { problems });
    return err(validationFailedError("generateTestingPlan", problems));
  }

  context.logger.info("generateTestingPlan: succeeded", { projectSpecId: spec.id, suiteCount: aiResult.value.suites.length });
  return ok(aiResult.value);
}
