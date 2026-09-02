// lib/humanizer/services/formatter.service.ts
import type { TitleSuggestion, ConversionDirection } from "../models/types";
import { titleGenerationPrompt, formatConversionPrompt } from "../prompts/title-and-format";
import { runHumanizerPrompt, HumanizerAiError } from "../providers/ai-engine.provider";
import { paragraphToBulletsHeuristic, bulletsToParagraphHeuristic } from "../utils/formatter";
import { logger } from "./_logger";

export interface FormatterOptions {
  userId: string;
}

export async function generateTitles(text: string, options: FormatterOptions): Promise<TitleSuggestion[]> {
  if (text.trim().length === 0) return [];
  const result = await runHumanizerPrompt(titleGenerationPrompt, { text }, { userId: options.userId, routingHint: "flash" });
  return result.titles;
}

export async function convertFormat(
  text: string,
  direction: ConversionDirection,
  options: FormatterOptions
): Promise<string> {
  if (text.trim().length === 0) return "";

  try {
    const result = await runHumanizerPrompt(
      formatConversionPrompt,
      { text, direction },
      { userId: options.userId, routingHint: "flash" }
    );
    return result.convertedText;
  } catch (err) {
    logger.warn("humanizer.format.ai_fallback", {
      error: err instanceof HumanizerAiError ? err.message : String(err),
    });
    return direction === "paragraph_to_bullets" ? paragraphToBulletsHeuristic(text) : bulletsToParagraphHeuristic(text);
  }
}
