/**
 * humanizer.service.ts
 * Rewrites text (typically AI-generated resume content) to remove robotic
 * or template-sounding phrasing while preserving every fact. Also runs a
 * deterministic pre-pass that strips well-known AI clichés before the
 * Gemini call, so the model has less to fix and results are more reliable.
 */

import { ServiceResult, success, failure } from "../models/resume.model";
import { generateContent } from "./generator.service";

const AI_CLICHE_PATTERNS: [RegExp, string][] = [
  [/\bin today's fast-paced (world|environment|industry)\b/gi, ""],
  [/\bleverage(d|s)?\b/gi, "use"],
  [/\bsynerg(y|ize|istic)\w*\b/gi, "collaboration"],
  [/\bdelve(d|s)? into\b/gi, "explore"],
  [/\bunlock(ed|s)? (the )?potential\b/gi, "improve results"],
  [/\bpassionate about\b/gi, "focused on"],
  [/\bproven track record\b/gi, "history"],
  [/\bresults-driven\b/gi, "results-focused"],
  [/\bteam player\b/gi, "collaborative teammate"],
];

function stripCliches(text: string): string {
  let result = text;
  for (const [pattern, replacement] of AI_CLICHE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

export interface HumanizeResult {
  original: string;
  humanized: string;
  clichesRemoved: number;
}

export async function humanizeText(text: string): Promise<ServiceResult<HumanizeResult>> {
  if (!text?.trim()) {
    return failure("INVALID_INPUT", "No text provided to humanize.");
  }

  const preProcessed = stripCliches(text);
  const clichesRemoved = countDifferences(text, preProcessed);

  const aiResult = await generateContent({
    task: "humanize",
    input: preProcessed,
  });

  if (!aiResult.ok || !aiResult.data) {
    // Fall back to the deterministic cliche-stripped version rather than
    // failing outright — still an improvement over the original.
    return success<HumanizeResult>({
      original: text,
      humanized: preProcessed,
      clichesRemoved,
    });
  }

  return success<HumanizeResult>({
    original: text,
    humanized: aiResult.data.output,
    clichesRemoved,
  });
}

function countDifferences(a: string, b: string): number {
  if (a === b) return 0;
  // Rough heuristic: count how many cliche patterns actually matched.
  return AI_CLICHE_PATTERNS.reduce(
    (count, [pattern]) => count + (a.match(pattern)?.length ?? 0),
    0
  );
}
