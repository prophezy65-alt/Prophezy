/**
 * lib/project-generator/models/security.model.ts
 *
 * Describes the generated security plan for a project: rate limits,
 * input validation rules, the JWT/auth flow, RBAC roles/permissions,
 * and sanitization rules.
 */

import { SecurityControlCategory, AuthStrategy } from "./enums";
import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface RateLimitRule {
  readonly scope: string; // e.g. "POST /api/generate" or "global"
  readonly requestsPerWindow: number;
  readonly windowSeconds: number;
  readonly keyStrategy: "ip" | "user_id" | "api_key";
}

export interface InputValidationRule {
  readonly targetField: string; // e.g. "GenerationRequest.source.text"
  readonly rule: string; // human-readable rule, e.g. "max length 20000 characters"
  readonly severity: "error" | "warning";
}

export interface AuthFlowStep {
  readonly order: number;
  readonly actor: "client" | "server" | "supabase_auth" | "database";
  readonly action: string;
}

export interface AuthFlow {
  readonly strategy: AuthStrategy;
  readonly steps: readonly AuthFlowStep[];
  readonly tokenLifetimeMinutes: number;
  readonly refreshStrategy: string;
}

export interface Permission {
  readonly resource: string; // e.g. "project_spec"
  readonly action: "create" | "read" | "update" | "delete" | "generate" | "export";
}

export interface Role {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly Permission[];
}

export interface SanitizationRule {
  readonly targetField: string;
  readonly strategy: "strip_html" | "escape_sql" | "normalize_unicode" | "reject_control_chars" | "trim_whitespace";
}

export interface SecurityControl {
  readonly id: UUID;
  readonly category: SecurityControlCategory;
  readonly title: string;
  readonly description: string;
  readonly implementationNotes: string;
}

export interface SecurityPlan {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly controls: readonly SecurityControl[];
  readonly rateLimits: readonly RateLimitRule[];
  readonly inputValidationRules: readonly InputValidationRule[];
  readonly authFlow: AuthFlow;
  readonly roles: readonly Role[];
  readonly sanitizationRules: readonly SanitizationRule[];
}

export function getControlsByCategory(
  plan: SecurityPlan,
  category: SecurityControlCategory
): SecurityControl[] {
  return plan.controls.filter((c) => c.category === category);
}

export function findRole(plan: SecurityPlan, name: string): Role | undefined {
  return plan.roles.find((r) => r.name === name);
}

export function validateSecurityPlan(plan: SecurityPlan): string[] {
  const problems: string[] = [];

  if (!isUUID(plan.id)) problems.push("SecurityPlan.id must be a UUID.");
  if (!isUUID(plan.projectSpecId)) problems.push("SecurityPlan.projectSpecId must be a UUID.");
  if (plan.controls.length === 0) problems.push("SecurityPlan.controls must contain at least one control.");
  if (plan.roles.length === 0) problems.push("SecurityPlan.roles must contain at least one role.");

  for (const rule of plan.rateLimits) {
    if (rule.requestsPerWindow <= 0) problems.push(`RateLimitRule "${rule.scope}" requestsPerWindow must be positive.`);
    if (rule.windowSeconds <= 0) problems.push(`RateLimitRule "${rule.scope}" windowSeconds must be positive.`);
  }

  const stepOrders = [...plan.authFlow.steps].map((s) => s.order).sort((a, b) => a - b);
  stepOrders.forEach((order, index) => {
    if (order !== index + 1) {
      problems.push("SecurityPlan.authFlow.steps ordering is not sequential starting at 1.");
    }
  });

  if (plan.authFlow.strategy !== AuthStrategy.NONE && plan.authFlow.steps.length === 0) {
    problems.push(`AuthFlow strategy "${plan.authFlow.strategy}" defines no steps.`);
  }

  const seenRoleNames = new Set<string>();
  for (const role of plan.roles) {
    if (seenRoleNames.has(role.name)) problems.push(`Duplicate role name "${role.name}".`);
    seenRoleNames.add(role.name);
    if (!isNonEmptyString(role.description)) problems.push(`Role "${role.name}" is missing a description.`);
  }

  return problems;
}
