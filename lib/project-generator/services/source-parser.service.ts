/**
 * lib/project-generator/services/source-parser.service.ts
 *
 * Normalizes any `GenerationSource` variant into plain text ready to feed
 * `project-spec.service.ts`. Text-based sources (idea/prompt/problem
 * statement) pass through after validation. File-based sources
 * (PDF/research paper/image/voice/flowchart) are extracted via an
 * injected `DocumentExtractor` when available — this should wrap the
 * existing `ocr.service.ts` (Tesseract + Gemini cleanup) already in the
 * codebase — falling back to the AI Core's multimodal extraction
 * (`AICoreClient.extractTextFromMedia`) when no dedicated extractor is
 * configured, so this service is fully functional even before that
 * integration is wired up.
 */

import { GenerationSource, GenerationSourceType, Result, GenerationError, ok, err, validateGenerationSource } from "../models";
import { invalidSourceError } from "./errors";
import type { ServiceContext } from "./types";

/**
 * Optional adapter over an existing document/image/audio extraction
 * pipeline (e.g. the codebase's `ocr.service.ts`). When provided, it is
 * preferred over the generic AI Core multimodal fallback because it can
 * use cheaper, purpose-built extraction (e.g. Tesseract) before falling
 * back to Gemini vision itself.
 */
export interface DocumentExtractor {
  extractText(input: {
    readonly storagePath: string;
    readonly mimeType: string;
    readonly kind: "pdf" | "research_paper" | "image" | "voice" | "flowchart";
  }): Promise<Result<string, GenerationError>>;
}

const FEATURE_KEY = "project-generator.source-extraction";

const EXTRACTION_INSTRUCTIONS: Record<
  Extract<GenerationSourceType, GenerationSourceType.PDF | GenerationSourceType.RESEARCH_PAPER | GenerationSourceType.IMAGE | GenerationSourceType.VOICE | GenerationSourceType.FLOWCHART>,
  string
> = {
  [GenerationSourceType.PDF]:
    "Extract the full readable text content of this PDF, preserving section headings and lists as plain text.",
  [GenerationSourceType.RESEARCH_PAPER]:
    "Extract the abstract, introduction, methodology, and conclusion sections of this research paper as plain text. " +
    "Summarize dense mathematical notation in words rather than reproducing symbols verbatim.",
  [GenerationSourceType.IMAGE]:
    "Describe the product, UI mockup, or concept shown in this image in enough detail to specify a software project from it.",
  [GenerationSourceType.VOICE]:
    "Transcribe this audio recording verbatim into plain text.",
  [GenerationSourceType.FLOWCHART]:
    "Describe every node, decision point, and edge/arrow in this flowchart image as a plain-text step-by-step process description.",
};

function kindForSourceType(
  type: GenerationSourceType
): "pdf" | "research_paper" | "image" | "voice" | "flowchart" {
  switch (type) {
    case GenerationSourceType.PDF:
      return "pdf";
    case GenerationSourceType.RESEARCH_PAPER:
      return "research_paper";
    case GenerationSourceType.IMAGE:
      return "image";
    case GenerationSourceType.VOICE:
      return "voice";
    case GenerationSourceType.FLOWCHART:
      return "flowchart";
    default:
      throw new Error(`kindForSourceType: unsupported source type "${type}".`);
  }
}

/**
 * Converts any `GenerationSource` into plain text. `documentExtractor` is
 * optional — omit it to always use the AI Core multimodal fallback.
 */
export async function parseGenerationSource(
  source: GenerationSource,
  context: ServiceContext,
  userId: string,
  documentExtractor?: DocumentExtractor
): Promise<Result<string, GenerationError>> {
  const problems = validateGenerationSource(source);
  if (problems.length > 0) {
    return err(invalidSourceError("parseGenerationSource", problems));
  }

  switch (source.type) {
    case GenerationSourceType.IDEA:
    case GenerationSourceType.PROMPT:
    case GenerationSourceType.PROBLEM_STATEMENT:
      context.logger.debug("parseGenerationSource: text source, passthrough", { type: source.type });
      return ok(source.text.trim());

    case GenerationSourceType.PDF:
    case GenerationSourceType.RESEARCH_PAPER:
    case GenerationSourceType.IMAGE:
    case GenerationSourceType.VOICE:
    case GenerationSourceType.FLOWCHART: {
      const kind = kindForSourceType(source.type);
      const mimeType =
        source.type === GenerationSourceType.PDF || source.type === GenerationSourceType.RESEARCH_PAPER
          ? "application/pdf"
          : source.mimeType;

      if (documentExtractor) {
        context.logger.info("parseGenerationSource: using injected DocumentExtractor", { kind, storagePath: source.storagePath });
        const result = await documentExtractor.extractText({ storagePath: source.storagePath, mimeType, kind });
        if (result.ok) return result;
        context.logger.warn("parseGenerationSource: DocumentExtractor failed, falling back to AI Core multimodal", {
          error: result.error.message,
        });
      }

      context.logger.info("parseGenerationSource: using AI Core multimodal extraction fallback", { kind });
      return context.aiCore.extractTextFromMedia({
        featureKey: FEATURE_KEY,
        storagePath: source.storagePath,
        mimeType,
        instructions: EXTRACTION_INSTRUCTIONS[source.type],
        userId,
      });
    }
  }
}
