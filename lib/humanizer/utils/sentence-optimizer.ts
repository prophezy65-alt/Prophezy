// lib/humanizer/utils/sentence-optimizer.ts
// Deterministic detection of sentence-level issues that hurt "natural flow"
// and "conciseness" — flags run-on sentences, filler-phrase padding, and
// passive-voice-heavy openings. Used to give the frontend instant inline
// suggestions before/alongside the AI rewrite, and to help
// clarity.service.ts compose the ReadabilityReport's qualitative signals.

export interface SentenceFlag {
  sentence: string;
  issue: "run_on" | "filler_phrase" | "passive_opening" | "weak_opener";
  detail: string;
}

const FILLER_PHRASES = [
  "it is important to note that",
  "in today's world",
  "in order to",
  "due to the fact that",
  "at the end of the day",
  "needless to say",
  "for all intents and purposes",
  "the fact of the matter is",
];

const WEAK_OPENERS = /^(there is|there are|it is|this is)\b/i;
const PASSIVE_OPENING = /^\w+\s+(was|were|is|are|been|being)\s+\w+ed\b/i;

const RUN_ON_WORD_THRESHOLD = 40;
const RUN_ON_CONJUNCTION_THRESHOLD = 3;

export function findSentenceFlags(text: string): SentenceFlag[] {
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const flags: SentenceFlag[] = [];

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;
    const conjunctionCount = (sentence.match(/\b(and|but|so|because|which|that)\b/gi) ?? []).length;

    if (wordCount > RUN_ON_WORD_THRESHOLD && conjunctionCount >= RUN_ON_CONJUNCTION_THRESHOLD) {
      flags.push({
        sentence,
        issue: "run_on",
        detail: `${wordCount} words with ${conjunctionCount} joining conjunctions — consider splitting into two sentences.`,
      });
    }

    const lowerSentence = sentence.toLowerCase();
    for (const phrase of FILLER_PHRASES) {
      if (lowerSentence.includes(phrase)) {
        flags.push({ sentence, issue: "filler_phrase", detail: `Contains filler phrase: "${phrase}"` });
      }
    }

    if (WEAK_OPENERS.test(sentence)) {
      flags.push({ sentence, issue: "weak_opener", detail: "Opens with a weak/vague construction — consider leading with the subject." });
    }

    if (PASSIVE_OPENING.test(sentence)) {
      flags.push({ sentence, issue: "passive_opening", detail: "Opens in passive voice — consider an active-voice restructure." });
    }
  }

  return flags;
}

export function computeConcisenessScore(text: string, flags: SentenceFlag[]): number {
  const sentenceCount = Math.max(text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length, 1);
  const flagDensity = flags.length / sentenceCount;
  return Math.round(Math.min(100, Math.max(0, 100 - flagDensity * 40)));
}
