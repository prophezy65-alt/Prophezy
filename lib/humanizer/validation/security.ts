// lib/humanizer/validation/security.ts
//
// Input-side sanitization and prompt-injection defense are REUSED from
// lib/assignment/validation/security.ts per the spec's "Reuse Validation"
// instruction — re-exported here so every humanizer file imports from a
// single local path (@/lib/humanizer/validation/security) rather than half
// the module reaching into lib/assignment/ directly.
//
// This file ADDS the one thing genuinely new to this module's threat model:
// "Safe AI Responses" — verifying the AI's rewritten output doesn't leak
// system-prompt content or echo back injected instructions it was supposed
// to have ignored.

export {
  sanitizePlainTextInput,
  sanitizeFileNameInput,
  scanAndNeutralizeInjection,
  wrapUntrustedContent,
} from "@/lib/assignment/validation/security";

const LEAK_INDICATOR_PATTERNS: RegExp[] = [
  /as an ai (language model|assistant)/gi,
  /my system prompt (is|says)/gi,
  /i (was|am) instructed to/gi,
  /<<<DOCUMENT_CONTENT_(START|END)>>>/g, // our own delimiter leaking into output means something went wrong
];

export interface OutputSafetyCheck {
  isSafe: boolean;
  flags: string[];
}

/**
 * Runs on AI-generated rewrite/analysis output BEFORE it's returned to the
 * user or persisted to history. Catches the two realistic failure modes:
 * (a) the model echoing back a fragment of its own instructions, and
 * (b) our own prompt delimiters leaking into the visible output (a sign the
 * model treated them as content rather than structural markers, which means
 * the rewrite itself may be unreliable and worth flagging for review).
 */
export function checkOutputSafety(text: string): OutputSafetyCheck {
  const flags: string[] = [];
  for (const pattern of LEAK_INDICATOR_PATTERNS) {
    // Reconstruct per-call: reusing a module-level RegExp with the /g flag
    // across multiple .test() calls would carry stateful lastIndex between
    // invocations and silently miss matches on subsequent calls.
    const freshPattern = new RegExp(pattern.source, pattern.flags);
    if (freshPattern.test(text)) {
      flags.push(`Matched leak-indicator pattern: ${pattern.source}`);
    }
  }
  return { isSafe: flags.length === 0, flags };
}
