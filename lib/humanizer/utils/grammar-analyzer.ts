// lib/humanizer/utils/grammar-analyzer.ts
// Cheap, dependency-free heuristic checks that catch a subset of common
// errors without an AI call — used to (a) provide instant feedback while the
// AI grammar-check prompt is in flight, and (b) sanity-check that the AI
// actually found the "obvious" issues.

export interface HeuristicGrammarIssue {
  match: string;
  suggestion: string;
  ruleType: "grammar" | "spelling" | "punctuation" | "style";
}

interface HeuristicRule {
  pattern: RegExp;
  ruleType: HeuristicGrammarIssue["ruleType"];
  buildSuggestion: (match: RegExpMatchArray) => string;
  description: string;
}

const RULES: HeuristicRule[] = [
  {
    pattern: /\b(a)\s+([aeiouAEIOU]\w*)/g,
    ruleType: "grammar",
    description: "a/an agreement",
    buildSuggestion: (m) => `an ${m[2]}`,
  },
  {
    pattern: /\b(their|there|they're)\b/gi,
    ruleType: "style",
    description: "commonly confused word — verify correct usage",
    buildSuggestion: (m) => m[0], // flag for review, don't auto-"correct" (context-dependent)
  },
  {
    pattern: /\s{2,}/g,
    ruleType: "punctuation",
    description: "multiple consecutive spaces",
    buildSuggestion: () => " ",
  },
  {
    pattern: /\b(\w+)\s+\1\b/gi,
    ruleType: "grammar",
    description: "repeated word",
    buildSuggestion: (m) => m[1]!,
  },
  {
    pattern: /,\s*,/g,
    ruleType: "punctuation",
    description: "doubled comma",
    buildSuggestion: () => ",",
  },
  {
    pattern: /\bi\b/g,
    ruleType: "grammar",
    description: "lowercase standalone 'i'",
    buildSuggestion: () => "I",
  },
];

export function runHeuristicGrammarScan(text: string): HeuristicGrammarIssue[] {
  const issues: HeuristicGrammarIssue[] = [];

  for (const rule of RULES) {
    const re = new RegExp(rule.pattern);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      // Skip the "their/there/they're" rule from producing an actionable
      // suggestion — it's flagged for the AI pass to resolve with context,
      // not something a regex can correct safely.
      if (rule.description !== "commonly confused word — verify correct usage") {
        issues.push({
          match: match[0],
          suggestion: rule.buildSuggestion(match),
          ruleType: rule.ruleType,
        });
      }
      if (re.lastIndex === match.index) re.lastIndex++;
    }
  }

  return issues;
}

/** Computes a 0-100 grammar score from an issue count normalized against
 * text length — used as the numeric GrammarAnalysis.score field, combining
 * both the AI-found issues and the heuristic pass's issue count so a short
 * snippet with one typo doesn't score identically to a long document with
 * one typo. */
export function computeGrammarScore(issueCount: number, wordCount: number): number {
  if (wordCount === 0) return 100;
  const issuesPer100Words = (issueCount / wordCount) * 100;
  const score = 100 - issuesPer100Words * 8; // each issue-per-100-words costs 8 points
  return Math.round(Math.min(100, Math.max(0, score)));
}
