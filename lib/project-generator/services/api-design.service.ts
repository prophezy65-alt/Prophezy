/**
 * lib/project-generator/services/api-design.service.ts
 *
 * Derives an `ApiDesign` (REST resources, endpoints, request/response
 * field schemas, error responses, auth requirements) from a `ProjectSpec`
 * and its `DatabaseSchema` via the AI Core.
 */

import {
  ApiDesign,
  AuthStrategy,
  DatabaseSchema,
  HttpMethod,
  ProjectSpec,
  Result,
  GenerationError,
  ok,
  err,
  validateApiDesign,
  FieldSchema,
  FieldType,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, coerceEnum, coerceBoolean, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.api-design";
const CACHE_TTL_SECONDS = 60 * 60;

const HTTP_METHOD_VALUES = Object.values(HttpMethod);
const AUTH_STRATEGY_VALUES = Object.values(AuthStrategy);
const FIELD_TYPE_VALUES: readonly FieldType[] = [
  "string",
  "number",
  "boolean",
  "uuid",
  "date",
  "object",
  "array",
  "enum",
  "file",
];

interface RawField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
  readonly enumValues: readonly string[] | null;
  readonly itemType: string | null;
  readonly nestedFields: readonly RawField[] | null;
  readonly example: unknown;
}

interface RawErrorResponse {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly description: string;
  readonly example: Record<string, unknown>;
}

interface RawEndpoint {
  readonly method: string;
  readonly path: string;
  readonly summary: string;
  readonly description: string;
  readonly requiresAuth: boolean;
  readonly authStrategy: string;
  readonly requiredRoles: readonly string[];
  readonly pathParams: readonly RawField[];
  readonly queryParams: readonly RawField[];
  readonly requestBody: readonly RawField[] | null;
  readonly successStatusCode: number;
  readonly responseBody: readonly RawField[];
  readonly errorResponses: readonly RawErrorResponse[];
  readonly rateLimitPerMinute: number | null;
}

interface RawResource {
  readonly name: string;
  readonly basePath: string;
  readonly endpoints: readonly RawEndpoint[];
}

interface RawApiDesignResponse {
  readonly title: string;
  readonly version: string;
  readonly baseUrl: string;
  readonly defaultAuthStrategy: string;
  readonly resources: readonly RawResource[];
  readonly globalErrorResponses: readonly RawErrorResponse[];
}

function parseField(raw: unknown, path: string): RawField {
  const f = assertObject(raw, path);
  return {
    name: assertString(f.name, `${path}.name`),
    // type is normalized through coerceEnum downstream (see
    // normalizeField), so tolerate a missing/blank value here.
    type: coerceString(f.type, ""),
    required: coerceBoolean(f.required, false),
    description: coerceString(f.description, "No description provided."),
    enumValues: f.enumValues ? assertArray(f.enumValues, `${path}.enumValues`).map((v, i) => assertString(v, `${path}.enumValues[${i}]`)) : null,
    itemType: f.itemType ? assertString(f.itemType, `${path}.itemType`) : null,
    nestedFields: f.nestedFields ? assertArray(f.nestedFields, `${path}.nestedFields`).map((nf, i) => parseField(nf, `${path}.nestedFields[${i}]`)) : null,
    example: f.example ?? null,
  };
}

/**
 * Returns null when an error response is missing its status code — a
 * code-less error entry can't be matched against real HTTP responses, so
 * it's dropped rather than failing the whole design (same rationale as
 * tryParseEndpoint).
 */
function tryParseErrorResponse(raw: unknown, path: string): RawErrorResponse | null {
  const e = assertObject(raw, path);
  if (typeof e.statusCode !== "number" || !Number.isFinite(e.statusCode)) return null;
  return {
    statusCode: e.statusCode,
    errorCode: coerceString(e.errorCode, "UNKNOWN_ERROR"),
    description: coerceString(e.description, "No description provided."),
    example: assertObject(e.example ?? {}, `${path}.example`),
  };
}

/**
 * `requestBody` is normally a plain array of field definitions, but the
 * model sometimes wraps it in an OpenAPI-like envelope instead, e.g.
 * `{ contentType: "application/json", schema: [...] }`. Rather than
 * crash on the shape mismatch, unwrap the array from `.schema` when
 * present. Returns null (no request body) when neither shape matches.
 */
function normalizeRequestBodyInput(raw: unknown): readonly unknown[] | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const schema = (raw as Record<string, unknown>).schema;
    if (Array.isArray(schema)) return schema;
  }
  return null;
}

/**
 * Returns null (rather than throwing) when an endpoint is missing a
 * structurally load-bearing field (method/path). Unlike `summary` or
 * `description`, an endpoint with no real path can't be turned into a
 * usable placeholder — "" isn't a valid route. Dropping just that one
 * malformed endpoint keeps the rest of the resource's API design intact
 * instead of failing the whole generation. The caller filters out nulls.
 */
function tryParseEndpoint(raw: unknown, path: string): RawEndpoint | null {
  const e = assertObject(raw, path);
  const method = typeof e.method === "string" && e.method.trim().length > 0 ? e.method : null;
  const endpointPath = typeof e.path === "string" && e.path.trim().length > 0 ? e.path : null;
  if (!method || !endpointPath) return null;

  const requestBodyArray = normalizeRequestBodyInput(e.requestBody);

  return {
    method,
    path: endpointPath,
    summary: coerceString(e.summary, "No summary provided."),
    description: coerceString(e.description, "No description provided."),
    requiresAuth: coerceBoolean(e.requiresAuth, true),
    // Re-resolved through coerceEnum(..., AuthStrategy.JWT) by the caller,
    // so this must not throw if the AI omits it.
    authStrategy: coerceString(e.authStrategy, "jwt"),
    requiredRoles: assertArray(e.requiredRoles ?? [], `${path}.requiredRoles`).map((r, i) => assertString(r, `${path}.requiredRoles[${i}]`)),
    pathParams: assertArray(e.pathParams ?? [], `${path}.pathParams`).map((p, i) => parseField(p, `${path}.pathParams[${i}]`)),
    queryParams: assertArray(e.queryParams ?? [], `${path}.queryParams`).map((p, i) => parseField(p, `${path}.queryParams[${i}]`)),
    requestBody: requestBodyArray ? requestBodyArray.map((f, i) => parseField(f, `${path}.requestBody[${i}]`)) : null,
    successStatusCode: typeof e.successStatusCode === "number" && Number.isFinite(e.successStatusCode) ? e.successStatusCode : 200,
    responseBody: assertArray(e.responseBody ?? [], `${path}.responseBody`).map((f, i) => parseField(f, `${path}.responseBody[${i}]`)),
    errorResponses: assertArray(e.errorResponses ?? [], `${path}.errorResponses`)
      .map((er, i) => tryParseErrorResponse(er, `${path}.errorResponses[${i}]`))
      .filter((er): er is RawErrorResponse => er !== null),
    rateLimitPerMinute: typeof e.rateLimitPerMinute === "number" ? e.rateLimitPerMinute : null,
  };
}

/**
 * Returns null when a resource is missing its name or basePath — both are
 * load-bearing identity for the resource, so it's dropped rather than
 * failing the whole design (same rationale as tryParseEndpoint).
 */
function tryParseResource(raw: unknown, path: string): RawResource | null {
  const r = assertObject(raw, path);
  const name = typeof r.name === "string" && r.name.trim().length > 0 ? r.name : null;
  const basePath = typeof r.basePath === "string" && r.basePath.trim().length > 0 ? r.basePath : null;
  if (!name || !basePath) return null;
  return {
    name,
    basePath,
    endpoints: assertArray(r.endpoints, `${path}.endpoints`)
      .map((e, i) => tryParseEndpoint(e, `${path}.endpoints[${i}]`))
      .filter((e): e is RawEndpoint => e !== null),
  };
}

function parseRawApiDesignResponse(raw: unknown): RawApiDesignResponse {
  const r = assertObject(raw, "$");
  const resources = assertArray(r.resources, "resources")
    .map((res, i) => tryParseResource(res, `resources[${i}]`))
    .filter((res): res is RawResource => res !== null)
    .filter((res) => res.endpoints.length > 0); // drop resources left empty after endpoint filtering
  if (resources.length === 0) throw new Error("resources must contain at least one entry with at least one valid endpoint.");
  return {
    // title/version/baseUrl are service-level metadata, not project
    // substance — default rather than fail the whole design over them.
    title: coerceString(r.title, "API"),
    version: coerceString(r.version, "v1"),
    baseUrl: coerceString(r.baseUrl, "/api"),
    // Re-resolved through coerceEnum(..., AuthStrategy.JWT) below, so it
    // must not throw here if the AI omits it.
    defaultAuthStrategy: coerceString(r.defaultAuthStrategy, "jwt"),
    resources,
    globalErrorResponses: assertArray(r.globalErrorResponses ?? [], "globalErrorResponses")
      .map((e, i) => tryParseErrorResponse(e, `globalErrorResponses[${i}]`))
      .filter((e): e is RawErrorResponse => e !== null),
  };
}

function normalizeField(raw: RawField): FieldSchema {
  return {
    name: raw.name,
    type: coerceEnum(raw.type, FIELD_TYPE_VALUES, "string"),
    required: raw.required,
    description: raw.description,
    enumValues: raw.enumValues ?? undefined,
    itemType: raw.itemType ? coerceEnum(raw.itemType, FIELD_TYPE_VALUES, "string") : undefined,
    nestedFields: raw.nestedFields ? raw.nestedFields.map(normalizeField) : undefined,
    example: raw.example,
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the API Design generator inside Prophezy's Project Generator.",
    "Given a ProjectSpec and its DatabaseSchema, design a complete REST API surface covering every module/feature",
    "and every table that needs CRUD-style access.",
    "",
    "Rules:",
    "- method MUST be one of: " + HTTP_METHOD_VALUES.join(", ") + ".",
    "- Every endpoint MUST have a non-empty \"path\" (e.g. \"/api/users/:id\") — an endpoint with no path is unusable and will be dropped.",
    "- GET and DELETE endpoints must NOT declare a requestBody.",
    "- requestBody, when present, MUST be a plain JSON array of field objects — NOT wrapped in an envelope",
    "  like { \"contentType\": ..., \"schema\": [...] }. Just the array itself.",
    "- Every \":param\" token used in an endpoint path MUST have a matching entry in pathParams.",
    "- authStrategy MUST be one of: " + AUTH_STRATEGY_VALUES.join(", ") + ".",
    "- field type MUST be one of: " + FIELD_TYPE_VALUES.join(", ") + "; array fields must set itemType.",
    "- successStatusCode must be a 2xx code; errorResponses statusCodes must be 4xx/5xx.",
    "- Include realistic error responses (400 validation, 401/403 auth, 404 not found, 429 rate limited) where relevant.",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "title": string, "version": string, "baseUrl": string, "defaultAuthStrategy": string,',
    '  "resources": [{ "name": string, "basePath": string, "endpoints": [...] }],',
    '  "globalErrorResponses": [...] }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec, schema: DatabaseSchema): string {
  const tableSummaries = schema.tables.map((t) => `- ${t.name}: ${t.description}`).join("\n");
  const featureSummaries = spec.features.map((f) => `- ${f.name}: ${f.description}`).join("\n");

  return [
    `Project: ${spec.title}`,
    spec.description,
    "",
    "Database tables:",
    tableSummaries,
    "",
    "Features to expose via the API:",
    featureSummaries,
    "",
    `Auth strategy in use: ${schema.tables.some((t) => t.rlsEnabled) ? "supabase_auth (RLS-backed)" : "jwt"}.`,
  ].join("\n");
}

export async function generateApiDesign(
  spec: ProjectSpec,
  schema: DatabaseSchema,
  context: ServiceContext
): Promise<Result<ApiDesign, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<ApiDesign>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(spec, schema),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    // Many endpoints x request/response field schemas x error responses
    // can exceed the 8192-token default the same way database schema can.
    maxOutputTokens: 16384,
    parse: (raw) => {
      const parsed = parseRawApiDesignResponse(raw);
      const design: ApiDesign = {
        id: context.ids.newId(),
        projectSpecId: spec.id,
        title: parsed.title,
        version: parsed.version,
        baseUrl: parsed.baseUrl,
        defaultAuthStrategy: coerceEnum(parsed.defaultAuthStrategy, AUTH_STRATEGY_VALUES, AuthStrategy.JWT),
        resources: parsed.resources.map((r) => ({
          id: context.ids.newId(),
          name: r.name,
          basePath: r.basePath,
          endpoints: r.endpoints.map((e) => ({
            id: context.ids.newId(),
            method: coerceEnum(e.method, HTTP_METHOD_VALUES, HttpMethod.GET),
            path: e.path,
            summary: e.summary,
            description: e.description,
            requiresAuth: e.requiresAuth,
            authStrategy: coerceEnum(e.authStrategy, AUTH_STRATEGY_VALUES, AuthStrategy.JWT),
            requiredRoles: e.requiredRoles,
            pathParams: e.pathParams.map(normalizeField),
            queryParams: e.queryParams.map(normalizeField),
            requestBody: e.requestBody ? e.requestBody.map(normalizeField) : null,
            successStatusCode: e.successStatusCode,
            responseBody: e.responseBody.map(normalizeField),
            errorResponses: e.errorResponses.map((er) => ({ ...er })),
            rateLimitPerMinute: e.rateLimitPerMinute,
          })),
        })),
        globalErrorResponses: parsed.globalErrorResponses.map((e) => ({ ...e })),
      };

      // Validate INSIDE parse so a semantically-invalid design throws here
      // and is caught by ai-core-client's corrective-retry loop instead of
      // being a terminal, unrecoverable failure.
      const problems = validateApiDesign(design);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return design;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = validateApiDesign(aiResult.value);
  if (problems.length > 0) {
    context.logger.error("generateApiDesign: validation failed", { problems });
    return err(validationFailedError("generateApiDesign", problems));
  }

  context.logger.info("generateApiDesign: succeeded", {
    projectSpecId: spec.id,
    resourceCount: aiResult.value.resources.length,
  });
  return ok(aiResult.value);
}