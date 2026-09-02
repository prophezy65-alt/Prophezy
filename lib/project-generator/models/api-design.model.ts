/**
 * lib/project-generator/models/api-design.model.ts
 *
 * Describes the REST API surface of a generated project: endpoints,
 * request/response field schemas, status codes, error shapes and the
 * auth requirement per endpoint.
 */

import { HttpMethod, AuthStrategy } from "./enums";
import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "uuid"
  | "date"
  | "object"
  | "array"
  | "enum"
  | "file";

export interface FieldSchema {
  readonly name: string;
  readonly type: FieldType;
  readonly required: boolean;
  readonly description: string;
  readonly enumValues?: readonly string[]; // required when type === "enum"
  readonly itemType?: FieldType; // required when type === "array"
  readonly nestedFields?: readonly FieldSchema[]; // for "object" / array-of-object
  readonly example: unknown;
}

export interface ErrorResponseSchema {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly description: string;
  readonly example: Record<string, unknown>;
}

export interface EndpointDefinition {
  readonly id: UUID;
  readonly method: HttpMethod;
  readonly path: string; // e.g. "/api/projects/:id"
  readonly summary: string;
  readonly description: string;
  readonly requiresAuth: boolean;
  readonly authStrategy: AuthStrategy;
  readonly requiredRoles: readonly string[];
  readonly pathParams: readonly FieldSchema[];
  readonly queryParams: readonly FieldSchema[];
  readonly requestBody: readonly FieldSchema[] | null;
  readonly successStatusCode: number;
  readonly responseBody: readonly FieldSchema[];
  readonly errorResponses: readonly ErrorResponseSchema[];
  readonly rateLimitPerMinute: number | null;
}

export interface ApiResource {
  readonly id: UUID;
  readonly name: string; // e.g. "Projects"
  readonly basePath: string; // e.g. "/api/projects"
  readonly endpoints: readonly EndpointDefinition[];
}

export interface ApiDesign {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly title: string;
  readonly version: string; // e.g. "v1"
  readonly baseUrl: string;
  readonly defaultAuthStrategy: AuthStrategy;
  readonly resources: readonly ApiResource[];
  readonly globalErrorResponses: readonly ErrorResponseSchema[];
}

const VALID_PATH_PATTERN = /^\/[a-zA-Z0-9\-_/:]*$/;

export function listAllEndpoints(design: ApiDesign): EndpointDefinition[] {
  return design.resources.flatMap((resource) => resource.endpoints);
}

export function findEndpoint(
  design: ApiDesign,
  method: HttpMethod,
  path: string
): EndpointDefinition | undefined {
  return listAllEndpoints(design).find((e) => e.method === method && e.path === path);
}

function extractPathParamNames(path: string): string[] {
  const matches = path.match(/:([a-zA-Z0-9_]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}

/**
 * Validates that every ":param" token in a path has a corresponding
 * pathParams entry, that HTTP methods carrying no body (GET/DELETE)
 * don't declare a requestBody, and that status codes are within
 * valid HTTP ranges.
 */
export function validateApiDesign(design: ApiDesign): string[] {
  const problems: string[] = [];

  if (!isUUID(design.id)) problems.push("ApiDesign.id must be a UUID.");
  if (!isUUID(design.projectSpecId)) problems.push("ApiDesign.projectSpecId must be a UUID.");
  if (!isNonEmptyString(design.baseUrl)) problems.push("ApiDesign.baseUrl is required.");
  if (design.resources.length === 0) problems.push("ApiDesign.resources must contain at least one resource.");

  const seenPaths = new Set<string>();

  for (const resource of design.resources) {
    if (!VALID_PATH_PATTERN.test(resource.basePath)) {
      problems.push(`Resource "${resource.name}" has an invalid basePath "${resource.basePath}".`);
    }
    if (resource.endpoints.length === 0) {
      problems.push(`Resource "${resource.name}" defines no endpoints.`);
    }

    for (const endpoint of resource.endpoints) {
      const key = `${endpoint.method} ${endpoint.path}`;
      if (seenPaths.has(key)) {
        problems.push(`Duplicate endpoint definition "${key}".`);
      }
      seenPaths.add(key);

      if (!VALID_PATH_PATTERN.test(endpoint.path)) {
        problems.push(`Endpoint "${key}" has an invalid path.`);
      }

      const declaredParamNames = new Set(endpoint.pathParams.map((p) => p.name));
      for (const tokenName of extractPathParamNames(endpoint.path)) {
        if (!declaredParamNames.has(tokenName)) {
          problems.push(`Endpoint "${key}" uses path token ":${tokenName}" but does not declare it in pathParams.`);
        }
      }

      if ((endpoint.method === HttpMethod.GET || endpoint.method === HttpMethod.DELETE) && endpoint.requestBody) {
        problems.push(`Endpoint "${key}" is ${endpoint.method} but declares a requestBody.`);
      }

      if (endpoint.successStatusCode < 200 || endpoint.successStatusCode >= 300) {
        problems.push(`Endpoint "${key}" successStatusCode ${endpoint.successStatusCode} is not a 2xx code.`);
      }

      for (const errorResp of endpoint.errorResponses) {
        if (errorResp.statusCode < 400 || errorResp.statusCode >= 600) {
          problems.push(`Endpoint "${key}" declares invalid error status code ${errorResp.statusCode}.`);
        }
      }

      if (endpoint.requiresAuth && endpoint.authStrategy === AuthStrategy.NONE) {
        problems.push(`Endpoint "${key}" requiresAuth but authStrategy is NONE.`);
      }

      for (const field of [...endpoint.pathParams, ...endpoint.queryParams, ...(endpoint.requestBody ?? [])]) {
        if (field.type === "enum" && (!field.enumValues || field.enumValues.length === 0)) {
          problems.push(`Endpoint "${key}" field "${field.name}" is type enum but declares no enumValues.`);
        }
        if (field.type === "array" && !field.itemType) {
          problems.push(`Endpoint "${key}" field "${field.name}" is type array but declares no itemType.`);
        }
      }
    }
  }

  return problems;
}
