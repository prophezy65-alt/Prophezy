/**
 * documentation.service.ts
 * "README Generator", "Project Documentation Generator", "Presentation
 * Outline", "Demo Script", and "Pitch Preparation" — all AI Core backed,
 * each validated before being trusted.
 */

import {
  Hackathon,
  HackathonIdea,
  PitchOutline,
  ServiceResult,
  success,
  failure,
} from "../models/hackathon.model";
import { pitchOutlineSchema, readmeContentSchema, validate } from "../validation/hackathon.validation";
import { AiCoreClient } from "../providers/ai-core.provider";
import { buildPitchOutlinePrompt, buildReadmePrompt } from "../prompts/hackathon-prompts";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";

export class DocumentationService {
  constructor(private readonly aiCore: AiCoreClient) {}

  async generateReadme(hackathon: Hackathon, idea: HackathonIdea): Promise<ServiceResult<string>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.readme",
          prompt: buildReadmePrompt(idea.title, idea.pitch, idea.techStackSuggestion, hackathon.title),
          temperature: 0.5,
          maxOutputTokens: 1800,
        })
      );

      const validation = validate(readmeContentSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned a malformed README.", validation.errors);
      }
      return success(validation.data.markdown);
    } catch (error) {
      logger.error("README generation failed", { ideaId: idea.id, error: (error as Error).message });
      return failure("README_GENERATION_FAILED", "Failed to generate README.");
    }
  }

  async generatePitchOutline(hackathon: Hackathon, idea: HackathonIdea): Promise<ServiceResult<PitchOutline>> {
    try {
      const raw = await withRetry(() =>
        this.aiCore.generateJson<unknown>({
          taskId: "hackathon.pitch_outline",
          prompt: buildPitchOutlinePrompt(hackathon, idea.title, idea.pitch),
          temperature: 0.6,
          maxOutputTokens: 700,
        })
      );

      const validation = validate(pitchOutlineSchema, raw);
      if (!validation.success) {
        return failure("AI_VALIDATION_FAILED", "AI Core returned a malformed pitch outline.", validation.errors);
      }
      return success(validation.data);
    } catch (error) {
      logger.error("Pitch outline generation failed", { ideaId: idea.id, error: (error as Error).message });
      return failure("PITCH_GENERATION_FAILED", "Failed to generate pitch outline.");
    }
  }

  /**
   * Demo script is derived directly from the pitch outline's demoFlow —
   * no extra AI call needed, keeping this fast and free once a pitch
   * outline already exists.
   */
  buildDemoScript(pitch: PitchOutline): string {
    const lines = [`Demo Script`, "", `Hook: ${pitch.hookLine}`, ""];
    pitch.demoFlow.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("", `Close: ${pitch.closingLine}`);
    return lines.join("\n");
  }
}
