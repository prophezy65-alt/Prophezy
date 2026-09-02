/**
 * lib/project-generator/services/project-spec.service.ts
 *
 * Turns a `GenerationRequest` (plus already-extracted source text) into a
 * fully-formed, validated `ProjectSpec` via the AI Core. This is the first
 * and most important step of the pipeline — every later artifact
 * (database schema, API design, roadmap, diagrams, estimation, export)
 * is derived from the `ProjectSpec` this service produces.
 *
 * The AI Core is asked for a simplified JSON shape (names/labels only, no
 * IDs) — this service is responsible for assigning stable UUIDs and
 * resolving name-based references (e.g. a feature's `moduleName`) into
 * real `moduleId` foreign keys. Trusting an LLM to emit consistent UUIDs
 * across a large JSON payload is fragile; resolving references
 * deterministically in code is not.
 */

import {
  DifficultyLevel,
  GenerationRequest,
  ProjectDomain,
  ProjectScale,
  ProjectSpec,
  LicenseType,
  Result,
  GenerationError,
  ok,
  err,
  validateGenerationRequest,
  validateProjectSpec,
  FolderNode,
  TechStackChoice,
} from "../models";
import { invalidSourceError, validationFailedError } from "./errors";
import { assertString, assertArray, coerceEnum, coerceBoolean, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.project-spec";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour — same source + prefs should be near-deterministic

interface RawObjective {
  readonly statement: string;
  readonly successCriteria: readonly string[];
}

interface RawScopeItem {
  readonly description: string;
  readonly inScope: boolean;
}

interface RawModule {
  readonly name: string;
  readonly description: string;
}

interface RawFeature {
  readonly name: string;
  readonly description: string;
  readonly userStory: string;
  readonly moduleName: string;
  readonly isCore: boolean;
}

interface RawFolderNode {
  readonly name: string;
  readonly type: "file" | "directory";
  readonly description: string;
  readonly children: readonly RawFolderNode[];
}

interface RawTechStackChoice {
  readonly category: TechStackChoice["category"];
  readonly name: string;
  readonly version: string;
  readonly rationale: string;
}

interface RawProjectSpecResponse {
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly domains: readonly string[];
  readonly objectives: readonly RawObjective[];
  readonly scope: readonly RawScopeItem[];
  readonly modules: readonly RawModule[];
  readonly features: readonly RawFeature[];
  readonly folderStructure: RawFolderNode;
  readonly techStack: readonly RawTechStackChoice[];
  readonly difficultyScore: number;
  readonly difficultyRationale: string;
  readonly complexityScore: number;
  readonly complexityRationale: string;
  readonly scale: string;
  readonly targetDifficultyLevel: string;
  readonly estimatedCostUsdMin: number;
  readonly estimatedCostUsdMax: number;
  readonly suggestedLicense: string;
  readonly tags: readonly string[];
}

function parseFolderNode(value: unknown, path: string): RawFolderNode {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Expected folder node object at "${path}".`);
  }
  const node = value as Record<string, unknown>;
  const type = node.type;
  if (type !== "file" && type !== "directory") {
    throw new Error(`Folder node at "${path}" must have type "file" or "directory".`);
  }
  const children = assertArray(node.children ?? [], `${path}.children`).map((child, index) =>
    parseFolderNode(child, `${path}.children[${index}]`)
  );
  return {
    name: assertString(node.name, `${path}.name`),
    type,
    description: coerceString(node.description, "No description provided."),
    children,
  };
}

/** Validates + narrows the AI Core's raw JSON into `RawProjectSpecResponse`. Throws on any structural mismatch. */
function parseRawProjectSpecResponse(raw: unknown): RawProjectSpecResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Expected a JSON object at the top level.");
  }
  const r = raw as Record<string, unknown>;

  const objectives = assertArray(r.objectives, "objectives").map((o, i) => {
    const obj = o as Record<string, unknown>;
    return {
      statement: assertString(obj.statement, `objectives[${i}].statement`),
      // successCriteria is elaboration on the objective, not the objective
      // itself (statement is) — default to [] instead of failing the whole
      // spec, same tolerance as milestone.acceptanceCriteria in roadmap.service.ts.
      successCriteria: assertArray(obj.successCriteria ?? [], `objectives[${i}].successCriteria`).map((s, j) =>
        assertString(s, `objectives[${i}].successCriteria[${j}]`)
      ),
    };
  });

  const scope = assertArray(r.scope, "scope").map((s) => {
    const item = s as Record<string, unknown>;
    return {
      description: coerceString(item.description, "No description provided."),
      inScope: coerceBoolean(item.inScope, true),
    };
  });

  const modules = assertArray(r.modules, "modules").map((m, i) => {
    const mod = m as Record<string, unknown>;
    return {
      name: assertString(mod.name, `modules[${i}].name`),
      description: coerceString(mod.description, "No description provided."),
    };
  });
  if (modules.length === 0) throw new Error("modules must contain at least one entry.");

  const features = assertArray(r.features, "features").map((f, i) => {
    const feat = f as Record<string, unknown>;
    return {
      name: assertString(feat.name, `features[${i}].name`),
      description: coerceString(feat.description, "No description provided."),
      // userStory is narrative elaboration, not the feature's identity —
      // safe to default rather than fail the whole spec over it.
      userStory: coerceString(feat.userStory, "No user story provided."),
      moduleName: assertString(feat.moduleName, `features[${i}].moduleName`),
      isCore: coerceBoolean(feat.isCore, true),
    };
  });

  const techStack = assertArray(r.techStack, "techStack").map((t, i) => {
    const tech = t as Record<string, unknown>;
    return {
      category: assertString(tech.category, `techStack[${i}].category`) as TechStackChoice["category"],
      name: assertString(tech.name, `techStack[${i}].name`),
      // version and rationale are supplementary detail on a real tech
      // choice (name/category are its identity) — default instead of
      // discarding the whole spec over a missing version string.
      version: coerceString(tech.version, "latest"),
      rationale: coerceString(tech.rationale, "No rationale provided."),
    };
  });

  return {
    title: assertString(r.title, "title"),
    tagline: assertString(r.tagline, "tagline"),
    description: coerceString(r.description, "No description provided."),
    // domains has a guaranteed non-empty fallback downstream in
    // mapDomains(), so tolerate an omitted array here instead of failing
    // over a field that can never actually end up empty in the final spec.
    domains: assertArray(r.domains ?? [], "domains").map((d, i) => assertString(d, `domains[${i}]`)),
    objectives,
    scope,
    modules,
    features,
    folderStructure: parseFolderNode(r.folderStructure, "folderStructure"),
    techStack,
    // difficultyScore/complexityScore are numeric labels (mapped to
    // Low/Moderate/High/Very High), not narrative content — a neutral
    // midpoint default when omitted is honest bookkeeping, not fabricated
    // analysis, and validateProjectSpec only checks the 0-100 range.
    difficultyScore: typeof r.difficultyScore === "number" && Number.isFinite(r.difficultyScore) ? r.difficultyScore : 50,
    difficultyRationale: coerceString(r.difficultyRationale, "No rationale provided."),
    complexityScore: typeof r.complexityScore === "number" && Number.isFinite(r.complexityScore) ? r.complexityScore : 50,
    complexityRationale: coerceString(r.complexityRationale, "No rationale provided."),
    // scale/targetDifficultyLevel/suggestedLicense are all mapped through
    // coerceEnum() in buildProjectSpec(), which already has a safe fallback
    // for unrecognized values — so pass an empty string through when the
    // AI omits the field entirely, instead of throwing before that
    // tolerant mapping ever gets a chance to run.
    scale: coerceString(r.scale, ""),
    targetDifficultyLevel: coerceString(r.targetDifficultyLevel, ""),
    // estimatedCostUsd only needs 0 <= min <= max (validateProjectSpec);
    // 0/0 reads as "not estimated" rather than asserting a false number.
    estimatedCostUsdMin: typeof r.estimatedCostUsdMin === "number" && Number.isFinite(r.estimatedCostUsdMin) ? r.estimatedCostUsdMin : 0,
    estimatedCostUsdMax: typeof r.estimatedCostUsdMax === "number" && Number.isFinite(r.estimatedCostUsdMax) ? r.estimatedCostUsdMax : 0,
    suggestedLicense: coerceString(r.suggestedLicense, ""),
    tags: assertArray(r.tags ?? [], "tags").map((t, i) => assertString(t, `tags[${i}]`)),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the Project Specification generator inside Prophezy's Project Generator.",
    "Given a user's idea/prompt/problem statement (already extracted to plain text), produce a complete,",
    "internally-consistent software project specification as JSON.",
    "",
    "Rules:",
    "- Every feature's \"moduleName\" MUST exactly match the \"name\" of one entry in \"modules\".",
    "- Include at least 3 and at most 12 modules.",
    "- Include at least 1 feature per module.",
    "- folderStructure must be a single root directory node whose children form a realistic project tree.",
    "- difficultyScore and complexityScore are integers from 0 to 100.",
    "- scale must be one of: prototype, mvp, production, enterprise.",
    "- targetDifficultyLevel must be one of: beginner, intermediate, advanced, expert.",
    "- estimatedCostUsdMin <= estimatedCostUsdMax, both in whole US dollars.",
    "- suggestedLicense must be one of: MIT, Apache-2.0, GPL-3.0, BSD-3-Clause, UNLICENSED, Proprietary.",
    "- domains must be drawn from the supported domain list provided in the user prompt.",
    "",
    "Respond with ONLY a single JSON object matching this shape (no prose, no Markdown fences):",
    "{",
    '  "title": string, "tagline": string, "description": string,',
    '  "domains": string[],',
    '  "objectives": [{ "statement": string, "successCriteria": string[] }],',
    '  "scope": [{ "description": string, "inScope": boolean }],',
    '  "modules": [{ "name": string, "description": string }],',
    '  "features": [{ "name": string, "description": string, "userStory": string, "moduleName": string, "isCore": boolean }],',
    '  "folderStructure": { "name": string, "type": "file"|"directory", "description": string, "children": [...] },',
    '  "techStack": [{ "category": string, "name": string, "version": string, "rationale": string }],',
    '  "difficultyScore": number, "difficultyRationale": string,',
    '  "complexityScore": number, "complexityRationale": string,',
    '  "scale": string, "targetDifficultyLevel": string,',
    '  "estimatedCostUsdMin": number, "estimatedCostUsdMax": number,',
    '  "suggestedLicense": string, "tags": string[]',
    "}",
  ].join("\n");
}

function buildUserPrompt(sourceText: string, request: GenerationRequest): string {
  const domainHint =
    request.preferences.preferredDomains.length > 0
      ? `Preferred domains: ${request.preferences.preferredDomains.join(", ")}.`
      : "No domain preference specified — choose the best fit.";
  const excludedHint =
    request.preferences.excludedDomains.length > 0
      ? `Excluded domains (do not use): ${request.preferences.excludedDomains.join(", ")}.`
      : "";
  const difficultyHint = request.preferences.targetDifficulty
    ? `Target difficulty: ${request.preferences.targetDifficulty}.`
    : "";
  const scaleHint = request.preferences.targetScale ? `Target scale: ${request.preferences.targetScale}.` : "";
  const moduleCapHint = request.preferences.maxModules
    ? `Do not exceed ${request.preferences.maxModules} modules.`
    : "";

  return [
    `Source material (from a "${request.source.type}" input):`,
    sourceText,
    "",
    domainHint,
    excludedHint,
    difficultyHint,
    scaleHint,
    moduleCapHint,
    `Respond in language: ${request.preferences.language}.`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function mapDomains(rawDomains: readonly string[]): ProjectDomain[] {
  const allDomains = Object.values(ProjectDomain);
  const mapped = rawDomains
    .map((d) => coerceEnum(d, allDomains, ProjectDomain.WEB_APP))
    .filter((d, index, arr) => arr.indexOf(d) === index);
  return mapped.length > 0 ? mapped : [ProjectDomain.WEB_APP];
}

function mapFolderNode(raw: RawFolderNode): FolderNode {
  return {
    name: raw.name,
    type: raw.type,
    description: raw.description,
    children: raw.children.map(mapFolderNode),
  };
}

/**
 * Builds a full `ProjectSpec` from the AI Core's raw response, assigning
 * UUIDs and resolving `moduleName` -> `moduleId` references deterministically.
 */
function buildProjectSpec(
  raw: RawProjectSpecResponse,
  request: GenerationRequest,
  ids: ServiceContext["ids"],
  nowISO: string
): ProjectSpec {
  const moduleIdByName = new Map<string, string>();
  const modules = raw.modules.map((m, index) => {
    const id = ids.newId();
    moduleIdByName.set(m.name, id);
    return { id, name: m.name, description: m.description, featureIds: [] as string[], order: index + 1 };
  });

  const features = raw.features.map((f) => {
    const moduleId = moduleIdByName.get(f.moduleName) ?? modules[0]!.id;
    return {
      id: ids.newId(),
      name: f.name,
      description: f.description,
      userStory: f.userStory,
      moduleId,
      isCore: f.isCore,
    };
  });

  const featureIdsByModuleId = new Map<string, string[]>();
  for (const feature of features) {
    const list = featureIdsByModuleId.get(feature.moduleId) ?? [];
    list.push(feature.id);
    featureIdsByModuleId.set(feature.moduleId, list);
  }
  const modulesWithFeatures = modules.map((m) => ({
    ...m,
    featureIds: featureIdsByModuleId.get(m.id) ?? [],
  }));

  const scale = coerceEnum(raw.scale, Object.values(ProjectScale), ProjectScale.MVP);
  const targetDifficultyLevel = coerceEnum(
    raw.targetDifficultyLevel,
    Object.values(DifficultyLevel),
    DifficultyLevel.INTERMEDIATE
  );
  const license = coerceEnum(raw.suggestedLicense, Object.values(LicenseType), LicenseType.MIT);

  const difficultyScore = Math.min(100, Math.max(0, Math.round(raw.difficultyScore)));
  const complexityScore = Math.min(100, Math.max(0, Math.round(raw.complexityScore)));
  const costMin = Math.max(0, Math.round(raw.estimatedCostUsdMin));
  const costMax = Math.max(costMin, Math.round(raw.estimatedCostUsdMax));

  const spec: ProjectSpec = {
    id: ids.newId(),
    generationRequestId: request.id,
    title: raw.title,
    tagline: raw.tagline,
    description: raw.description,
    domains: mapDomains(raw.domains),
    objectives: raw.objectives.map((o) => ({ id: ids.newId(), statement: o.statement, successCriteria: o.successCriteria })),
    scope: raw.scope.map((s) => ({ id: ids.newId(), description: s.description, inScope: s.inScope })),
    modules: modulesWithFeatures,
    features,
    folderStructure: mapFolderNode(raw.folderStructure),
    techStack: raw.techStack.map((t) => ({ ...t })),
    difficulty: { score: difficultyScore, label: labelForScore(difficultyScore), rationale: raw.difficultyRationale },
    complexity: { score: complexityScore, label: labelForScore(complexityScore), rationale: raw.complexityRationale },
    scale,
    targetDifficultyLevel,
    estimatedCostUsd: { min: costMin, max: costMax },
    license,
    tags: raw.tags.map((t) => ({ key: "topic", value: t })),
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  return spec;
}

function labelForScore(score: number): string {
  if (score < 25) return "Low";
  if (score < 50) return "Moderate";
  if (score < 75) return "High";
  return "Very High";
}

/**
 * Generates a validated `ProjectSpec` from a `GenerationRequest` and its
 * already-extracted plain-text source (see `source-parser.service.ts`).
 */
export async function generateProjectSpec(
  request: GenerationRequest,
  sourceText: string,
  context: ServiceContext
): Promise<Result<ProjectSpec, GenerationError>> {
  const requestProblems = validateGenerationRequest(request);
  if (requestProblems.length > 0) {
    return err(invalidSourceError("generateProjectSpec", requestProblems));
  }
  if (sourceText.trim().length === 0) {
    return err(invalidSourceError("generateProjectSpec", ["Extracted source text is empty."]));
  }

  const aiResult = await context.aiCore.runStructured<ProjectSpec>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(sourceText, request),
    userId: request.userId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    parse: (raw) => {
      const parsedRaw = parseRawProjectSpecResponse(raw);
      const spec = buildProjectSpec(parsedRaw, request, context.ids, context.clock.nowISO());

      // Validate INSIDE parse so a semantically-invalid spec throws here
      // and is caught by ai-core-client's corrective-retry loop (which
      // feeds the specific validation problems back to the AI) instead of
      // being a terminal, unrecoverable failure.
      const problems = validateProjectSpec(spec);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return spec;
    },
  });

  if (!aiResult.ok) return aiResult;

  const specProblems = validateProjectSpec(aiResult.value);
  if (specProblems.length > 0) {
    context.logger.error("generateProjectSpec: generated ProjectSpec failed validation", { problems: specProblems });
    return err(validationFailedError("generateProjectSpec", specProblems));
  }

  context.logger.info("generateProjectSpec: succeeded", {
    projectSpecId: aiResult.value.id,
    title: aiResult.value.title,
    moduleCount: aiResult.value.modules.length,
    featureCount: aiResult.value.features.length,
  });

  return ok(aiResult.value);
}
