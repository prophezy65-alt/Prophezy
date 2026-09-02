/**
 * lib/project-generator/services/security.service.ts
 *
 * Generates a `SecurityPlan` (rate limits, input validation rules, auth
 * flow, RBAC roles/permissions, sanitization rules) from a `ProjectSpec`
 * and `ApiDesign` via the AI Core.
 */

import {
  ApiDesign,
  AuthStrategy,
  ProjectSpec,
  Result,
  GenerationError,
  ok,
  err,
  SecurityControlCategory,
  SecurityPlan,
  validateSecurityPlan,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, coerceEnum, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.security";
const CACHE_TTL_SECONDS = 60 * 60;

const CONTROL_CATEGORY_VALUES = Object.values(SecurityControlCategory);
const AUTH_STRATEGY_VALUES = Object.values(AuthStrategy);
const SANITIZATION_STRATEGIES = ["strip_html", "escape_sql", "normalize_unicode", "reject_control_chars", "trim_whitespace"] as const;
const PERMISSION_ACTIONS = ["create", "read", "update", "delete", "generate", "export"] as const;
const AUTH_ACTOR_VALUES = ["client", "server", "supabase_auth", "database"] as const;

interface RawControl {
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly implementationNotes: string;
}

interface RawRateLimit {
  readonly scope: string;
  readonly requestsPerWindow: number;
  readonly windowSeconds: number;
  readonly keyStrategy: string;
}

interface RawValidationRule {
  readonly targetField: string;
  readonly rule: string;
  readonly severity: string;
}

interface RawAuthStep {
  readonly order: number;
  readonly actor: string;
  readonly action: string;
}

interface RawPermission {
  readonly resource: string;
  readonly action: string;
}

interface RawRole {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly RawPermission[];
}

interface RawSanitizationRule {
  readonly targetField: string;
  readonly strategy: string;
}

interface RawSecurityPlanResponse {
  readonly controls: readonly RawControl[];
  readonly rateLimits: readonly RawRateLimit[];
  readonly inputValidationRules: readonly RawValidationRule[];
  readonly authFlow: {
    readonly strategy: string;
    readonly steps: readonly RawAuthStep[];
    readonly tokenLifetimeMinutes: number;
    readonly refreshStrategy: string;
  };
  readonly roles: readonly RawRole[];
  readonly sanitizationRules: readonly RawSanitizationRule[];
}

function parseControl(raw: unknown, path: string): RawControl {
  const c = assertObject(raw, path);
  return {
    // category is normalized through coerceEnum downstream.
    category: coerceString(c.category, ""),
    title: assertString(c.title, `${path}.title`),
    description: coerceString(c.description, "No description provided."),
    implementationNotes: coerceString(c.implementationNotes, "No implementation notes provided."),
  };
}

function parseRateLimit(raw: unknown, path: string): RawRateLimit {
  const r = assertObject(raw, path);
  return {
    scope: assertString(r.scope, `${path}.scope`),
    // Reasonable, clearly-generic config defaults — not a claim about the
    // project's actual traffic, just a starting point the same way "order"
    // defaults to array position. 60 req/60s is a common conservative
    // default rate limit.
    requestsPerWindow: typeof r.requestsPerWindow === "number" && Number.isFinite(r.requestsPerWindow) ? r.requestsPerWindow : 60,
    windowSeconds: typeof r.windowSeconds === "number" && Number.isFinite(r.windowSeconds) ? r.windowSeconds : 60,
    // keyStrategy is normalized through coerceEnum downstream.
    keyStrategy: coerceString(r.keyStrategy, ""),
  };
}

function parseValidationRule(raw: unknown, path: string): RawValidationRule {
  const v = assertObject(raw, path);
  return {
    targetField: assertString(v.targetField, `${path}.targetField`),
    rule: assertString(v.rule, `${path}.rule`),
    // severity is normalized through coerceEnum downstream.
    severity: coerceString(v.severity, ""),
  };
}

function parseAuthStep(raw: unknown, path: string, index: number): RawAuthStep {
  const s = assertObject(raw, path);
  // "order" is positional bookkeeping (the system prompt already fixes it
  // to be sequential starting at 1) — same rationale as phase.order in
  // roadmap.service.ts, so derive it from array position when omitted.
  const order = typeof s.order === "number" && Number.isFinite(s.order) ? s.order : index + 1;
  // actor is normalized through coerceEnum downstream.
  return { order, actor: coerceString(s.actor, ""), action: assertString(s.action, `${path}.action`) };
}

function parsePermission(raw: unknown, path: string): RawPermission {
  const p = assertObject(raw, path);
  // action is normalized through coerceEnum downstream.
  return { resource: assertString(p.resource, `${path}.resource`), action: coerceString(p.action, "") };
}

function parseRole(raw: unknown, path: string): RawRole {
  const r = assertObject(raw, path);
  return {
    name: assertString(r.name, `${path}.name`),
    description: coerceString(r.description, "No description provided."),
    permissions: assertArray(r.permissions ?? [], `${path}.permissions`).map((p, i) => parsePermission(p, `${path}.permissions[${i}]`)),
  };
}

function parseSanitizationRule(raw: unknown, path: string): RawSanitizationRule {
  const s = assertObject(raw, path);
  // strategy is normalized through coerceEnum downstream.
  return { targetField: assertString(s.targetField, `${path}.targetField`), strategy: coerceString(s.strategy, "") };
}

function parseRawSecurityPlanResponse(raw: unknown): RawSecurityPlanResponse {
  const r = assertObject(raw, "$");
  const controls = assertArray(r.controls, "controls").map((c, i) => parseControl(c, `controls[${i}]`));
  const roles = assertArray(r.roles, "roles").map((role, i) => parseRole(role, `roles[${i}]`));
  if (controls.length === 0) throw new Error("controls must contain at least one entry.");
  if (roles.length === 0) throw new Error("roles must contain at least one entry.");

  const authFlowRaw = assertObject(r.authFlow, "authFlow");
  return {
    controls,
    rateLimits: assertArray(r.rateLimits ?? [], "rateLimits").map((rl, i) => parseRateLimit(rl, `rateLimits[${i}]`)),
    inputValidationRules: assertArray(r.inputValidationRules ?? [], "inputValidationRules").map((v, i) =>
      parseValidationRule(v, `inputValidationRules[${i}]`)
    ),
    authFlow: {
      // strategy is normalized through coerceEnum downstream.
      strategy: coerceString(authFlowRaw.strategy, ""),
      steps: assertArray(authFlowRaw.steps ?? [], "authFlow.steps").map((s, i) => parseAuthStep(s, `authFlow.steps[${i}]`, i)),
      // A config default, not a claim about the actual project — 60
      // minutes is a common, conservative JWT lifetime.
      tokenLifetimeMinutes:
        typeof authFlowRaw.tokenLifetimeMinutes === "number" && Number.isFinite(authFlowRaw.tokenLifetimeMinutes)
          ? authFlowRaw.tokenLifetimeMinutes
          : 60,
      refreshStrategy: coerceString(authFlowRaw.refreshStrategy, "No refresh strategy specified."),
    },
    roles,
    sanitizationRules: assertArray(r.sanitizationRules ?? [], "sanitizationRules").map((s, i) =>
      parseSanitizationRule(s, `sanitizationRules[${i}]`)
    ),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the Security Plan generator inside Prophezy's Project Generator.",
    "Given a ProjectSpec and its ApiDesign, produce a complete security plan.",
    "",
    "Rules:",
    "- control category MUST be one of: " + CONTROL_CATEGORY_VALUES.join(", ") + ".",
    "- authFlow.strategy MUST be one of: " + AUTH_STRATEGY_VALUES.join(", ") + ".",
    "- authFlow.steps[].order must be sequential starting at 1; actor MUST be one of: " + AUTH_ACTOR_VALUES.join(", ") + ".",
    "- sanitizationRules[].strategy MUST be one of: " + SANITIZATION_STRATEGIES.join(", ") + ".",
    "- Permission action MUST be one of: " + PERMISSION_ACTIONS.join(", ") + ".",
    "- Include at least one rate limit rule for the AI generation endpoints (they are the most expensive to abuse).",
    "- Include at least two distinct roles (e.g. a standard user role and an admin/service role).",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "controls": [...], "rateLimits": [...], "inputValidationRules": [...],',
    '  "authFlow": { "strategy": string, "steps": [...], "tokenLifetimeMinutes": number, "refreshStrategy": string },',
    '  "roles": [...], "sanitizationRules": [...] }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec, design: ApiDesign): string {
  const authEndpointCount = design.resources.flatMap((r) => r.endpoints).filter((e) => e.requiresAuth).length;
  return [
    `Project: ${spec.title}`,
    spec.description,
    "",
    `Default auth strategy already chosen for the API: ${design.defaultAuthStrategy}.`,
    `${authEndpointCount} of the API's endpoints require authentication.`,
  ].join("\n");
}

export async function generateSecurityPlan(
  spec: ProjectSpec,
  design: ApiDesign,
  context: ServiceContext
): Promise<Result<SecurityPlan, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<SecurityPlan>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(spec, design),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    parse: (raw) => {
      const parsed = parseRawSecurityPlanResponse(raw);
      const plan: SecurityPlan = {
        id: context.ids.newId(),
        projectSpecId: spec.id,
        controls: parsed.controls.map((c) => ({
          id: context.ids.newId(),
          category: coerceEnum(c.category, CONTROL_CATEGORY_VALUES, SecurityControlCategory.INPUT_VALIDATION),
          title: c.title,
          description: c.description,
          implementationNotes: c.implementationNotes,
        })),
        rateLimits: parsed.rateLimits.map((rl) => ({
          scope: rl.scope,
          requestsPerWindow: Math.max(1, Math.round(rl.requestsPerWindow)),
          windowSeconds: Math.max(1, Math.round(rl.windowSeconds)),
          keyStrategy: coerceEnum(rl.keyStrategy, ["ip", "user_id", "api_key"] as const, "user_id"),
        })),
        inputValidationRules: parsed.inputValidationRules.map((v) => ({
          targetField: v.targetField,
          rule: v.rule,
          severity: coerceEnum(v.severity, ["error", "warning"] as const, "error"),
        })),
        authFlow: {
          strategy: coerceEnum(parsed.authFlow.strategy, AUTH_STRATEGY_VALUES, AuthStrategy.SUPABASE_AUTH),
          steps: [...parsed.authFlow.steps]
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ order: s.order, actor: coerceEnum(s.actor, AUTH_ACTOR_VALUES, "server"), action: s.action })),
          tokenLifetimeMinutes: Math.max(1, Math.round(parsed.authFlow.tokenLifetimeMinutes)),
          refreshStrategy: parsed.authFlow.refreshStrategy,
        },
        roles: parsed.roles.map((r) => ({
          name: r.name,
          description: r.description,
          permissions: r.permissions.map((p) => ({
            resource: p.resource,
            action: coerceEnum(p.action, PERMISSION_ACTIONS, "read"),
          })),
        })),
        sanitizationRules: parsed.sanitizationRules.map((s) => ({
          targetField: s.targetField,
          strategy: coerceEnum(s.strategy, SANITIZATION_STRATEGIES, "trim_whitespace"),
        })),
      };

      // Validate INSIDE parse so a semantically-invalid plan throws here
      // and is caught by ai-core-client's corrective-retry loop instead of
      // being a terminal, unrecoverable failure.
      const problems = validateSecurityPlan(plan);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return plan;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = validateSecurityPlan(aiResult.value);
  if (problems.length > 0) {
    context.logger.error("generateSecurityPlan: validation failed", { problems });
    return err(validationFailedError("generateSecurityPlan", problems));
  }

  context.logger.info("generateSecurityPlan: succeeded", { projectSpecId: spec.id, controlCount: aiResult.value.controls.length });
  return ok(aiResult.value);
}
