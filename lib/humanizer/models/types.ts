// lib/humanizer/models/types.ts
// Core domain types for the Humanizer Intelligence Engine. Mirrors the
// pattern established in lib/assignment/models/types.ts — plain data types,
// no classes, consumed by every service/prompt/export module below.

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type HumanizerInputSource =
  | "pdf"
  | "docx"
  | "txt"
  | "markdown"
  | "html"
  | "plain_text";

export type ContentDomain =
  | "research_paper"
  | "assignment"
  | "notes"
  | "resume"
  | "cover_letter"
  | "email"
  | "blog_post"
  | "report"
  | "general";

// ---------------------------------------------------------------------------
// Rewrite operation
// ---------------------------------------------------------------------------

export type RewriteStyle =
  | "humanize"
  | "academic"
  | "professional"
  | "student"
  | "business"
  | "seo"
  | "email"
  | "cover_letter"
  | "resume_bullet";

export type RewriteLengthOp = "none" | "simplify" | "expand" | "shorten";

export type ToneRegister = "formal" | "casual" | "friendly" | "technical";

export interface RewriteOptions {
  style: RewriteStyle;
  tone: ToneRegister | null;
  lengthOp: RewriteLengthOp;
  domain: ContentDomain;
  preserveFormatting: boolean;
}

export interface Rewrite {
  id: string;
  userId: string;
  originalText: string;
  rewrittenText: string;
  options: RewriteOptions;
  grammar: GrammarAnalysis;
  readability: ReadabilityReport;
  toneProfile: ToneProfile;
  changesSummary: string;
  createdAt: string;
  modelUsed: string;
}

export interface RewriteHistoryEntry {
  id: string;
  userId: string;
  rewriteId: string;
  originalPreview: string; // first ~200 chars, for list views
  rewrittenPreview: string;
  style: RewriteStyle;
  tone: ToneRegister | null;
  domain: ContentDomain;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tone
// ---------------------------------------------------------------------------

export interface ToneProfile {
  detectedTone: "formal" | "casual" | "friendly" | "technical" | "academic" | "mixed";
  formalityScore: number; // 0-100
  confidenceScore: number; // 0-1
  notes: string[];
}

// ---------------------------------------------------------------------------
// Grammar
// ---------------------------------------------------------------------------

export interface GrammarIssueDetail {
  originalText: string;
  suggestion: string;
  ruleType: "grammar" | "spelling" | "punctuation" | "style";
}

export interface GrammarAnalysis {
  score: number; // 0-100, 100 = no issues found
  issues: GrammarIssueDetail[];
  issueDensityPer100Words: number;
}

// ---------------------------------------------------------------------------
// Readability / clarity
// ---------------------------------------------------------------------------

export interface ReadabilityReport {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  averageSentenceLength: number;
  averageSyllablesPerWord: number;
  wordCount: number;
  sentenceCount: number;
  clarityScore: number; // 0-100 composite
  professionalismScore: number; // 0-100
  vocabularyDiversity: number; // type-token ratio, 0-1
  sentenceComplexity: "low" | "moderate" | "high";
}

// ---------------------------------------------------------------------------
// Formatter operations
// ---------------------------------------------------------------------------

export type ConversionDirection = "paragraph_to_bullets" | "bullets_to_paragraph";

export interface TitleSuggestion {
  title: string;
  style: "descriptive" | "seo" | "catchy" | "formal";
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface HumanizerAnalyticsEvent {
  userId: string;
  rewriteId: string | null;
  eventType:
    | "rewrite_requested"
    | "rewrite_completed"
    | "grammar_check"
    | "readability_check"
    | "export"
    | "search";
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface UsageAnalyticsSummary {
  userId: string;
  totalRewrites: number;
  favoriteStyle: RewriteStyle | null;
  averageReadabilityImprovement: number; // delta in fleschReadingEase, original -> rewritten
  averageGrammarScoreImprovement: number;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchMode = "semantic" | "keyword" | "history";

export interface SearchResult {
  rewriteId: string;
  snippet: string;
  score: number; // relevance score, 0-1
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type HumanizerExportFormat = "pdf" | "docx" | "markdown" | "html" | "txt" | "json";

export interface HumanizerExportRequest {
  rewriteId: string;
  format: HumanizerExportFormat;
  includeOriginal: boolean;
  includeAnalysis: boolean;
}

export interface HumanizerExportResult {
  format: HumanizerExportFormat;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}
