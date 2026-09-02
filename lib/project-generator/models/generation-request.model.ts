/**
 * lib/project-generator/models/generation-request.model.ts
 *
 * Represents the raw input a user submits to the Project Generator,
 * before any AI processing happens. One request can originate from
 * text, a document, an image, audio, or a hand-drawn/exported flowchart.
 */

import { GenerationSourceType, ProjectDomain, DifficultyLevel, ProjectScale } from "./enums";
import { UUID, ISODateString, isNonEmptyString, isUUID } from "./shared.model";

/** Discriminated union: exactly one source payload per request. */
export type GenerationSource =
  | { readonly type: GenerationSourceType.IDEA; readonly text: string }
  | { readonly type: GenerationSourceType.PROMPT; readonly text: string }
  | { readonly type: GenerationSourceType.PROBLEM_STATEMENT; readonly text: string }
  | { readonly type: GenerationSourceType.PDF; readonly storagePath: string; readonly fileName: string; readonly sizeBytes: number }
  | { readonly type: GenerationSourceType.RESEARCH_PAPER; readonly storagePath: string; readonly fileName: string; readonly sizeBytes: number }
  | { readonly type: GenerationSourceType.IMAGE; readonly storagePath: string; readonly fileName: string; readonly sizeBytes: number; readonly mimeType: string }
  | { readonly type: GenerationSourceType.VOICE; readonly storagePath: string; readonly fileName: string; readonly durationSeconds: number; readonly mimeType: string }
  | { readonly type: GenerationSourceType.FLOWCHART; readonly storagePath: string; readonly fileName: string; readonly mimeType: string };

/** User-tunable preferences that steer generation without changing the source. */
export interface GenerationPreferences {
  readonly preferredDomains: readonly ProjectDomain[];
  readonly excludedDomains: readonly ProjectDomain[];
  readonly targetDifficulty: DifficultyLevel | null;
  readonly targetScale: ProjectScale | null;
  readonly includeDiagrams: boolean;
  readonly includeDeploymentGuides: boolean;
  readonly includeTestingPlan: boolean;
  readonly includeSecurityPlan: boolean;
  readonly includeGithubTemplates: boolean;
  readonly maxModules: number | null;
  readonly language: string; // BCP-47, e.g. "en-US"
}

export const DEFAULT_GENERATION_PREFERENCES: GenerationPreferences = {
  preferredDomains: [],
  excludedDomains: [],
  targetDifficulty: null,
  targetScale: null,
  includeDiagrams: true,
  includeDeploymentGuides: true,
  includeTestingPlan: true,
  includeSecurityPlan: true,
  includeGithubTemplates: true,
  maxModules: null,
  language: "en-US",
};

export interface GenerationRequest {
  readonly id: UUID;
  readonly userId: UUID;
  readonly source: GenerationSource;
  readonly preferences: GenerationPreferences;
  readonly createdAt: ISODateString;
}

const MAX_TEXT_SOURCE_LENGTH = 20_000;
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_VOICE_DURATION_SECONDS = 15 * 60; // 15 minutes

/**
 * Structural + business-rule validation for a raw generation source.
 * Returns a list of human-readable problems; empty array means valid.
 * This mirrors (but does not replace) the dedicated validation/ module —
 * models own the invariants of their own shape.
 */
export function validateGenerationSource(source: GenerationSource): string[] {
  const problems: string[] = [];

  switch (source.type) {
    case "idea":
    case "prompt":
    case "problem_statement": {
      if (!isNonEmptyString(source.text)) {
        problems.push(`${source.type} source must include non-empty text.`);
      } else if (source.text.length > MAX_TEXT_SOURCE_LENGTH) {
        problems.push(`${source.type} text exceeds ${MAX_TEXT_SOURCE_LENGTH} characters.`);
      }
      break;
    }
    case "pdf":
    case "research_paper": {
      if (!isNonEmptyString(source.storagePath)) problems.push("Document source requires a storagePath.");
      if (!isNonEmptyString(source.fileName)) problems.push("Document source requires a fileName.");
      if (!source.fileName.toLowerCase().endsWith(".pdf")) problems.push("Document source must be a .pdf file.");
      if (source.sizeBytes <= 0 || source.sizeBytes > MAX_FILE_SIZE_BYTES) {
        problems.push(`Document size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.`);
      }
      break;
    }
    case "image": {
      if (!isNonEmptyString(source.storagePath)) problems.push("Image source requires a storagePath.");
      if (!/^image\/(png|jpeg|jpg|webp)$/i.test(source.mimeType)) {
        problems.push("Image source must be png, jpeg, or webp.");
      }
      if (source.sizeBytes <= 0 || source.sizeBytes > MAX_FILE_SIZE_BYTES) {
        problems.push(`Image size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes.`);
      }
      break;
    }
    case "voice": {
      if (!isNonEmptyString(source.storagePath)) problems.push("Voice source requires a storagePath.");
      if (!/^audio\//i.test(source.mimeType)) problems.push("Voice source mimeType must start with audio/.");
      if (source.durationSeconds <= 0 || source.durationSeconds > MAX_VOICE_DURATION_SECONDS) {
        problems.push(`Voice duration must be between 1 and ${MAX_VOICE_DURATION_SECONDS} seconds.`);
      }
      break;
    }
    case "flowchart": {
      if (!isNonEmptyString(source.storagePath)) problems.push("Flowchart source requires a storagePath.");
      if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/i.test(source.mimeType)) {
        problems.push("Flowchart source must be an image (png, jpeg, webp, or svg).");
      }
      break;
    }
  }

  return problems;
}

export function validateGenerationRequest(request: GenerationRequest): string[] {
  const problems: string[] = [];
  if (!isUUID(request.id)) problems.push("GenerationRequest.id must be a UUID.");
  if (!isUUID(request.userId)) problems.push("GenerationRequest.userId must be a UUID.");
  if (request.preferences.maxModules !== null && request.preferences.maxModules <= 0) {
    problems.push("preferences.maxModules must be a positive integer when provided.");
  }
  problems.push(...validateGenerationSource(request.source));
  return problems;
}
