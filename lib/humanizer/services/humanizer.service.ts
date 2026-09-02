// lib/humanizer/services/humanizer.service.ts
//
// The ONE function API routes call to go from "raw text + rewrite options"
// to a fully-analyzed Rewrite: runs the rewrite, then grammar/readability/
// tone analysis on the RESULT (so scores reflect what the user actually
// gets), checks output safety, persists to history, and logs analytics.

import { randomUUID } from "crypto";
import type { Rewrite, RewriteOptions } from "../models/types";
import { runRewrite } from "./rewrite.service";
import { checkAndCorrectGrammar } from "./grammar.service";
import { analyzeReadability } from "./clarity.service";
import { analyzeTone } from "./tone.service";
import { saveRewriteToHistory } from "./history.service";
import { logHumanizerEvent } from "./analytics.service";
import { checkOutputSafety, sanitizePlainTextInput } from "../validation/security";
import { logger } from "./_logger";

export interface HumanizeRequestOptions {
  userId: string;
  saveToHistory?: boolean;
}

export async function humanizeText(
  rawText: string,
  options: RewriteOptions,
  requestOptions: HumanizeRequestOptions
): Promise<Rewrite> {
  const text = sanitizePlainTextInput(rawText, 30000);
  const rewriteId = randomUUID();

  await logHumanizerEvent({
    userId: requestOptions.userId,
    rewriteId,
    eventType: "rewrite_requested",
    metadata: { style: options.style, tone: options.tone ?? "none", lengthOp: options.lengthOp },
    timestamp: new Date().toISOString(),
  });

  const rewriteOutcome = await runRewrite(text, options, { userId: requestOptions.userId });

  const safetyCheck = checkOutputSafety(rewriteOutcome.rewrittenText);
  if (!safetyCheck.isSafe) {
    logger.warn("humanizer.output_safety_flagged", { rewriteId, flags: safetyCheck.flags });
  }

  // Run grammar + readability + tone on the REWRITTEN text — these scores
  // describe what the user is about to receive, not the input.
  const [grammarOutcome, toneProfile] = await Promise.all([
    checkAndCorrectGrammar(rewriteOutcome.rewrittenText, { userId: requestOptions.userId }),
    analyzeTone(rewriteOutcome.rewrittenText, { userId: requestOptions.userId }),
  ]);
  const readability = analyzeReadability(rewriteOutcome.rewrittenText);

  const rewrite: Rewrite = {
    id: rewriteId,
    userId: requestOptions.userId,
    originalText: text,
    rewrittenText: rewriteOutcome.rewrittenText,
    options,
    grammar: grammarOutcome.analysis,
    readability,
    toneProfile,
    changesSummary: rewriteOutcome.changesSummary,
    createdAt: new Date().toISOString(),
    modelUsed: "gemini-2.5-via-core-engine",
  };

  if (requestOptions.saveToHistory ?? true) {
    try {
      await saveRewriteToHistory(rewrite);
    } catch (err) {
      // History persistence failure shouldn't fail the user-facing rewrite —
      // they still got their result, just log it for follow-up.
      logger.error("humanizer.history_save_failed_non_fatal", { rewriteId, error: String(err) });
    }
  }

  await logHumanizerEvent({
    userId: requestOptions.userId,
    rewriteId,
    eventType: "rewrite_completed",
    metadata: {
      grammarScore: rewrite.grammar.score,
      readabilityScore: rewrite.readability.fleschReadingEase,
      outputFlagged: !safetyCheck.isSafe,
    },
    timestamp: new Date().toISOString(),
  });

  return rewrite;
}

/** Lightweight analysis-only entry point — computes grammar/readability/tone
 * for a piece of text WITHOUT running a rewrite. Used by the frontend's live
 * "quality score" panel while the user is still editing. */
export async function analyzeTextQuality(
  rawText: string,
  options: { userId: string }
): Promise<Pick<Rewrite, "grammar" | "readability" | "toneProfile">> {
  const text = sanitizePlainTextInput(rawText, 30000);

  const [grammarOutcome, toneProfile] = await Promise.all([
    checkAndCorrectGrammar(text, { userId: options.userId }),
    analyzeTone(text, { userId: options.userId }),
  ]);
  const readability = analyzeReadability(text);

  return { grammar: grammarOutcome.analysis, readability, toneProfile };
}
