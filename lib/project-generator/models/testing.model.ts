/**
 * lib/project-generator/models/testing.model.ts
 *
 * Describes a generated testing plan: individual test cases grouped by
 * type and by the feature/endpoint/table they exercise.
 */

import { TestType } from "./enums";
import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface TestAssertion {
  readonly description: string;
  readonly expected: string;
}

export interface TestCase {
  readonly id: UUID;
  readonly type: TestType;
  readonly title: string;
  readonly targetRef: string; // e.g. "POST /api/projects" or "ProjectService.generate()"
  readonly setup: readonly string[];
  readonly steps: readonly string[];
  readonly assertions: readonly TestAssertion[];
  readonly isEdgeCase: boolean;
}

export interface TestSuite {
  readonly id: UUID;
  readonly name: string;
  readonly filePath: string; // e.g. "__tests__/project-service.test.ts"
  readonly testCases: readonly TestCase[];
}

export interface TestingPlan {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly suites: readonly TestSuite[];
  readonly coverageTargetPercent: number;
  readonly testRunnerCommand: string; // e.g. "npm run test"
}

export function countTestsByType(plan: TestingPlan): Record<TestType, number> {
  const counts: Record<TestType, number> = {
    [TestType.UNIT]: 0,
    [TestType.INTEGRATION]: 0,
    [TestType.API]: 0,
    [TestType.EDGE_CASE]: 0,
    [TestType.E2E]: 0,
  };
  for (const suite of plan.suites) {
    for (const testCase of suite.testCases) {
      counts[testCase.type] += 1;
    }
  }
  return counts;
}

export function validateTestingPlan(plan: TestingPlan): string[] {
  const problems: string[] = [];

  if (!isUUID(plan.id)) problems.push("TestingPlan.id must be a UUID.");
  if (!isUUID(plan.projectSpecId)) problems.push("TestingPlan.projectSpecId must be a UUID.");
  if (plan.suites.length === 0) problems.push("TestingPlan.suites must contain at least one suite.");
  if (plan.coverageTargetPercent < 0 || plan.coverageTargetPercent > 100) {
    problems.push("TestingPlan.coverageTargetPercent must be within 0-100.");
  }
  if (!isNonEmptyString(plan.testRunnerCommand)) {
    problems.push("TestingPlan.testRunnerCommand is required.");
  }

  const seenFilePaths = new Set<string>();
  for (const suite of plan.suites) {
    if (seenFilePaths.has(suite.filePath)) {
      problems.push(`Duplicate test suite filePath "${suite.filePath}".`);
    }
    seenFilePaths.add(suite.filePath);

    if (suite.testCases.length === 0) {
      problems.push(`Suite "${suite.name}" defines no test cases.`);
    }
    for (const testCase of suite.testCases) {
      if (testCase.assertions.length === 0) {
        problems.push(`Test case "${testCase.title}" defines no assertions.`);
      }
      if (testCase.isEdgeCase && testCase.type !== TestType.EDGE_CASE) {
        problems.push(`Test case "${testCase.title}" flagged isEdgeCase but type is "${testCase.type}", expected "edge_case".`);
      }
    }
  }

  return problems;
}
