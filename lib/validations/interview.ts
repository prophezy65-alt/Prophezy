import { z } from "zod";

export const interviewTypeSchema = z.enum([
  "hr",
  "technical",
  "coding",
  "behavioral",
  "system-design",
  "ai-ml",
  "data-science",
  "software-engineering",
  "frontend",
  "backend",
  "full-stack",
  "devops",
  "cloud",
  "cyber-security",
  "business-analyst",
  "product-manager",
  "research",
  "medical",
  "law",
  "mba",
  "college-viva",
  "practical-exam",
]);

export const seniority = z.enum(["intern", "junior", "mid", "senior", "staff+"]);

export const startSessionSchema = z.object({
  interviewType: interviewTypeSchema,
  role: z.string().min(2, "Role is required").max(200),
  company: z.string().max(200).optional(),
  seniority: seniority.default("mid"),
  jobDescription: z.string().max(20_000).optional(),
  resumeText: z.string().max(20_000).optional(),
  projectContext: z.string().max(20_000).optional(),
  skills: z.array(z.string().min(1)).max(50).optional(),
  questionCount: z.number().int().min(1).max(30).default(8),
});
export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const submitAnswerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  answerText: z.string().min(1, "Answer cannot be empty").max(10_000),
});
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;

export const evaluateAnswerSchema = z.object({
  question: z.string().min(1),
  answerText: z.string().min(1).max(10_000),
  interviewType: interviewTypeSchema,
  role: z.string().min(1),
});
export type EvaluateAnswerInput = z.infer<typeof evaluateAnswerSchema>;

export const skillGapRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type SkillGapRequestInput = z.infer<typeof skillGapRequestSchema>;

export const exportRequestSchema = z.object({
  sessionId: z.string().uuid(),
  format: z.enum(["pdf", "docx", "markdown", "json"]),
});
export type ExportRequestInput = z.infer<typeof exportRequestSchema>;

export const companySearchSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200).optional(),
});
export type CompanySearchInput = z.infer<typeof companySearchSchema>;
