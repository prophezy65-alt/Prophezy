/**
 * lib/document/analysis/complexity-analyzer.ts
 * Real Flesch-Kincaid Grade Level formula (standard, widely used) with a
 * syllable-counting heuristic (vowel-group counting, the same approach
 * every dependency-free FK implementation uses since true syllabification
 * needs a pronunciation dictionary).
 */

export interface ComplexityResult {
  fleschKincaidGrade: number;
  complexityScore: number; // 0..100, normalized from FK grade for easy display
  readingLevel: string;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const matches = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

export function computeComplexity(text: string, words: string[], sentences: string[]): ComplexityResult {
  if (words.length === 0 || sentences.length === 0) {
    return { fleschKincaidGrade: 0, complexityScore: 0, readingLevel: "unknown" };
  }

  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllableCount / words.length;

  // Flesch-Kincaid Grade Level formula.
  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const clampedGrade = Math.max(0, Math.min(18, grade));

  return {
    fleschKincaidGrade: Number(clampedGrade.toFixed(1)),
    complexityScore: Number(((clampedGrade / 18) * 100).toFixed(1)),
    readingLevel: gradeToReadingLevel(clampedGrade),
  };
}

function gradeToReadingLevel(grade: number): string {
  if (grade < 6) return "elementary";
  if (grade < 9) return "middle_school";
  if (grade < 13) return "high_school";
  if (grade < 16) return "college";
  return "graduate";
}
