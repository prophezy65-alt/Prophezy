// lib/humanizer/validation/schemas.ts
//
// Zod-based validation, per the spec's explicit "VALIDATION: Strict
// TypeScript, Zod Validation" requirement — unlike lib/assignment, which
// uses dependency-free validators to avoid forcing a new dependency, this
// module uses zod directly since it was explicitly requested.
//
// Peer dependency: npm install zod

import { z } from "zod";

export const rewriteStyleSchema = z.enum([
  "humanize",
  "academic",
  "professional",
  "student",
  "business",
  "seo",
  "email",
  "cover_letter",
  "resume_bullet",
]);

export const toneRegisterSchema = z.enum(["formal", "casual", "friendly", "technical"]);
export const lengthOpSchema = z.enum(["none", "simplify", "expand", "shorten"]);
export const contentDomainSchema = z.enum([
  "research_paper",
  "assignment",
  "notes",
  "resume",
  "cover_letter",
  "email",
  "blog_post",
  "report",
  "general",
]);

export const humanizerExportFormatSchema = z.enum(["pdf", "docx", "markdown", "html", "txt", "json"]);
export const conversionDirectionSchema = z.enum(["paragraph_to_bullets", "bullets_to_paragraph"]);
export const searchModeSchema = z.enum(["semantic", "keyword", "history"]);

export const rewriteRequestSchema = z.object({
  text: z
    .string()
    .min(1, "text must not be empty")
    .max(30000, "text exceeds the 30,000 character limit for a single rewrite"),
  style: rewriteStyleSchema,
  tone: toneRegisterSchema.nullable().default(null),
  lengthOp: lengthOpSchema.default("none"),
  domain: contentDomainSchema.default("general"),
  preserveFormatting: z.boolean().default(true),
});
export type RewriteRequestInput = z.infer<typeof rewriteRequestSchema>;

export const grammarCheckRequestSchema = z.object({
  text: z.string().min(1).max(30000),
});
export type GrammarCheckRequestInput = z.infer<typeof grammarCheckRequestSchema>;

export const toneAnalysisRequestSchema = z.object({
  text: z.string().min(1).max(30000),
});
export type ToneAnalysisRequestInput = z.infer<typeof toneAnalysisRequestSchema>;

export const titleGenerationRequestSchema = z.object({
  text: z.string().min(1).max(30000),
});
export type TitleGenerationRequestInput = z.infer<typeof titleGenerationRequestSchema>;

export const formatConversionRequestSchema = z.object({
  text: z.string().min(1).max(30000),
  direction: conversionDirectionSchema,
});
export type FormatConversionRequestInput = z.infer<typeof formatConversionRequestSchema>;

export const humanizerExportRequestSchema = z.object({
  rewriteId: z.string().uuid(),
  format: humanizerExportFormatSchema,
  includeOriginal: z.boolean().default(true),
  includeAnalysis: z.boolean().default(true),
});
export type HumanizerExportRequestInput = z.infer<typeof humanizerExportRequestSchema>;

export const searchRequestSchema = z.object({
  mode: searchModeSchema,
  query: z.string().max(500).optional(),
  styleFilter: rewriteStyleSchema.optional(),
  domainFilter: contentDomainSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
}).refine((data) => data.mode === "history" || (data.query && data.query.trim().length > 0), {
  message: "`query` is required for semantic and keyword search modes",
  path: ["query"],
});
export type SearchRequestInput = z.infer<typeof searchRequestSchema>;

export const historyListRequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type HistoryListRequestInput = z.infer<typeof historyListRequestSchema>;

/** Wraps a zod parse in a consistent { success, data, errors } shape so API
 * routes don't need to know zod's SafeParseReturnType internals. */
export function parseOrError<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
