// lib/assignment/services/validator.service.ts
// Runs the full quality-check suite over a document's questions/answers and
// returns a QualityReport. Grammar/tone/consistency use the AI quality-check
// prompt; duplicate-content detection is a deterministic keyword-similarity
// pre-filter (cheap) that flags candidates for the frontend to review —
// this module never claims to run exhaustive plagiarism detection against
// external sources, per the platform's "Plagiarism Awareness" scope.

import type {
  DetectedQuestion,
  QualityReport,
  GrammarIssue,
  CitationIssue,
  DuplicateContentMatch,
  ConsistencyIssue,
  ReferenceEntry,
} from "../models/types";
import { qualityCheckPrompt } from "../prompts/quality-check";
import { runAssignmentPrompt } from "../providers/ai-engine.provider";
import { extractKeywords, keywordJaccardSimilarity } from "../utils/keyword-extractor";
import { assessCitationQuality } from "./citation.service";

const DUPLICATE_SIMILARITY_THRESHOLD = 0.55;

export interface RunQualityChecksOptions {
  userId: string;
  documentId: string;
}

export async function runQualityChecks(
  questions: DetectedQuestion[],
  answerTexts: Map<string, string>, // questionId -> generated/submitted answer text
  references: ReferenceEntry[],
  options: RunQualityChecksOptions
): Promise<QualityReport> {
  const combinedText = Array.from(answerTexts.values()).join("\n\n---\n\n");

  const [grammarAndTone, duplicateMatches] = await Promise.all([
    runGrammarAndToneCheck(combinedText, options),
    Promise.resolve(detectDuplicateContent(questions)),
  ]);

  const citationIssues = validateCitations(references);
  const consistencyIssues = buildConsistencyIssues(grammarAndTone.consistencyNotes, questions);

  return {
    documentId: options.documentId,
    grammarIssues: grammarAndTone.grammarIssues,
    citationIssues,
    duplicateMatches,
    consistencyIssues,
    toneAssessment: {
      detectedTone: grammarAndTone.detectedTone,
      suggestions: grammarAndTone.toneSuggestions,
    },
    plagiarismAwarenessNote:
      "This check flags textual similarity between answers WITHIN your own uploaded files. " +
      "It does not search the internet or any external database, and is not a substitute for " +
      "your institution's plagiarism detection tools.",
    generatedAt: new Date().toISOString(),
  };
}

async function runGrammarAndToneCheck(
  text: string,
  options: RunQualityChecksOptions
): Promise<{
  grammarIssues: GrammarIssue[];
  detectedTone: "casual" | "academic" | "professional" | "mixed";
  toneSuggestions: string[];
  consistencyNotes: string[];
}> {
  if (text.trim().length === 0) {
    return { grammarIssues: [], detectedTone: "academic", toneSuggestions: [], consistencyNotes: [] };
  }

  const result = await runAssignmentPrompt(
    qualityCheckPrompt,
    { text },
    { userId: options.userId }
  );

  const grammarIssues: GrammarIssue[] = result.grammarIssues.map((issue) => {
    const offset = text.indexOf(issue.originalText);
    return {
      offset: offset >= 0 ? offset : 0,
      length: issue.originalText.length,
      originalText: issue.originalText,
      suggestion: issue.suggestion,
      ruleType: issue.ruleType,
    };
  });

  return {
    grammarIssues,
    detectedTone: result.detectedTone,
    toneSuggestions: result.toneSuggestions,
    consistencyNotes: result.consistencyNotes,
  };
}

/** Pairwise keyword-similarity scan across all questions in the document.
 * O(n^2) but n is bounded (a single assignment rarely exceeds a few hundred
 * questions), and this is a cheap deterministic pre-filter — a genuinely
 * production system would follow this with a pgvector embedding comparison
 * for matches above the threshold, wired in once the embeddings table
 * exists on the DB side (outside this module's DO-NOT-MODIFY schema scope). */
function detectDuplicateContent(questions: DetectedQuestion[]): DuplicateContentMatch[] {
  const matches: DuplicateContentMatch[] = [];

  for (let i = 0; i < questions.length; i++) {
    const a = questions[i];
    if (!a) continue;
    const keywordsA = a.keywords.length > 0 ? a.keywords : extractKeywords(a.cleanedText);

    for (let j = i + 1; j < questions.length; j++) {
      const b = questions[j];
      if (!b) continue;
      const keywordsB = b.keywords.length > 0 ? b.keywords : extractKeywords(b.cleanedText);

      const similarity = keywordJaccardSimilarity(keywordsA, keywordsB);
      if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
        matches.push({
          sourceQuestionId: a.id,
          matchedQuestionId: b.id,
          similarityScore: Math.round(similarity * 100) / 100,
          matchedSpan: b.cleanedText.slice(0, 160),
        });
      }
    }
  }

  return matches;
}

function validateCitations(references: ReferenceEntry[]): CitationIssue[] {
  const issues: CitationIssue[] = [];
  for (const ref of references) {
    const assessment = assessCitationQuality({
      type: ref.type,
      title: ref.title,
      authors: ref.authors,
      year: ref.year,
      publisher: ref.publisher,
      url: ref.url,
    });
    if (!assessment.isLikelyReliable) {
      for (const reason of assessment.reasons) {
        issues.push({ referenceId: ref.id, issue: reason, severity: "warning" });
      }
    }
  }
  return issues;
}

function buildConsistencyIssues(notes: string[], questions: DetectedQuestion[]): ConsistencyIssue[] {
  return notes.map((note) => ({
    description: note,
    locations: questions.map((q) => q.id), // AI notes are document-level; specific question attribution
    severity: "info" as const,               // would require a more granular prompt in a later iteration
  }));
}
