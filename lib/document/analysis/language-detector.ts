/**
 * lib/document/analysis/language-detector.ts
 *
 * Dependency-free language detection via common "stopword" frequency —
 * the same technique libraries like `franc`/`langdetect` use under the
 * hood at a coarse level, just with a smaller language set. Good enough to
 * route English vs Spanish/French/German/Hindi/etc. study material; not a
 * substitute for a full statistical n-gram model if you need broader
 * coverage later (that's a drop-in replacement behind this same function).
 */

const STOPWORD_PROFILES: Record<string, string[]> = {
  en: ["the", "and", "is", "in", "to", "of", "a", "that", "it", "for", "with", "as", "on"],
  es: ["el", "la", "de", "que", "y", "en", "un", "es", "por", "con", "para", "los", "las"],
  fr: ["le", "la", "de", "et", "est", "en", "un", "que", "pour", "dans", "les", "des", "avec"],
  de: ["der", "die", "das", "und", "ist", "in", "zu", "den", "mit", "für", "auf", "des", "ein"],
  hi: ["है", "और", "का", "के", "में", "की", "यह", "से", "को", "पर", "एक"],
  pt: ["o", "a", "de", "que", "e", "em", "um", "para", "com", "os", "as", "do", "da"],
};

export interface LanguageDetectionResult {
  language: string; // ISO 639-1
  confidence: number; // 0..1
}

export function detectLanguage(text: string): LanguageDetectionResult {
  const sample = text.toLowerCase().slice(0, 5000);
  const words = sample.match(/[\p{L}]+/gu) ?? [];

  if (words.length < 10) {
    return { language: "en", confidence: 0.3 }; // too little text to be confident; default to English
  }

  const wordSet = new Set(words);
  const scores: Record<string, number> = {};

  for (const [lang, stopwords] of Object.entries(STOPWORD_PROFILES)) {
    let hits = 0;
    for (const sw of stopwords) if (wordSet.has(sw)) hits++;
    scores[lang] = hits / stopwords.length;
  }

  const [bestLang, bestScore] = Object.entries(scores).sort((a, b) => b[1]! - a[1]!)[0]!;

  return {
    language: bestScore > 0.15 ? bestLang : "en",
    confidence: Number(Math.min(1, bestScore * 1.5).toFixed(2)),
  };
}
