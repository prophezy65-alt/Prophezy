/**
 * resume.validation.ts
 * Zod schemas for validating resume content at every boundary:
 * - client form submission
 * - AI-generated content before it's saved
 * - parsed content from uploaded files
 *
 * Requires: `zod` (npm install zod)
 */

import { z } from "zod";

export const linkSchema = z.object({
  label: z.string().max(60),
  url: z.string().max(500),
  type: z
    .enum(["github", "linkedin", "portfolio", "website", "other"])
    .optional(),
});

export const dateRangeSchema = z.object({
  start: z.string().max(20).default(""),
  end: z.string().nullable().optional(),
  isCurrent: z.boolean().optional(),
});

export const contactInfoSchema = z.object({
  fullName: z.string().max(120),
  email: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(120).optional(),
  links: z.array(linkSchema).max(10).default([]),
});

export const summarySectionSchema = z.object({
  headline: z.string().max(150).optional(),
  summary: z.string().max(2000).optional(),
});

export const educationEntrySchema = z.object({
  id: z.string(),
  institution: z.string().max(200),
  degree: z.string().max(200),
  fieldOfStudy: z.string().max(200).optional(),
  dateRange: dateRangeSchema,
  gpa: z.string().max(20).optional(),
  location: z.string().max(120).optional(),
  highlights: z.array(z.string().max(300)).max(10).optional(),
});

export const experienceEntrySchema = z.object({
  id: z.string(),
  company: z.string().max(200),
  role: z.string().max(200),
  dateRange: dateRangeSchema,
  location: z.string().max(120).optional(),
  bullets: z.array(z.string().min(1).max(400)).max(15),
  isInternship: z.boolean().optional(),
  techStack: z.array(z.string().max(50)).max(30).optional(),
});

export const projectEntrySchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  description: z.string().max(500).optional(),
  bullets: z.array(z.string().min(1).max(400)).max(10),
  techStack: z.array(z.string().max(50)).max(30).optional(),
  link: z.string().max(500).optional(),
  dateRange: dateRangeSchema.optional(),
});

export const skillGroupSchema = z.object({
  id: z.string(),
  category: z.string().max(80),
  items: z.array(z.string().max(60)).max(50),
});

export const certificateEntrySchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  issuer: z.string().max(200).optional(),
  date: z.string().max(20).optional(),
  url: z.string().max(500).optional(),
});

export const achievementEntrySchema = z.object({
  id: z.string(),
  title: z.string().max(200),
  description: z.string().max(400).optional(),
  date: z.string().max(20).optional(),
});

export const sectionConfigSchema = z.object({
  type: z.enum([
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "certificates",
    "achievements",
    "links",
  ]),
  visible: z.boolean(),
  order: z.number().int().nonnegative(),
  customTitle: z.string().max(60).optional(),
});

export const resumeContentSchema = z.object({
  contact: contactInfoSchema,
  summary: summarySectionSchema,
  experience: z.array(experienceEntrySchema).max(20),
  education: z.array(educationEntrySchema).max(10),
  projects: z.array(projectEntrySchema).max(20),
  skills: z.array(skillGroupSchema).max(15),
  certificates: z.array(certificateEntrySchema).max(20),
  achievements: z.array(achievementEntrySchema).max(20),
  sectionOrder: z.array(sectionConfigSchema),
});

export const templateIdSchema = z.enum([
  "professional",
  "modern",
  "minimal",
  "google",
  "microsoft",
  "amazon",
  "meta",
  "apple",
  "academic",
  "research",
  "student",
  "fresher",
  "ai-engineer",
  "software-engineer",
  "data-scientist",
]);

export const createResumeSchema = z.object({
  title: z.string().min(1).max(150),
  templateId: templateIdSchema,
  content: resumeContentSchema,
  targetRole: z.string().max(150).optional(),
  targetJobDescription: z.string().max(10000).optional(),
});

export const updateResumeSchema = createResumeSchema.partial();

export const exportFormatSchema = z.enum([
  "pdf",
  "docx",
  "markdown",
  "json",
  "html",
]);

export const aiTaskTypeSchema = z.enum([
  "improve_summary",
  "rewrite_experience",
  "improve_project",
  "improve_skills",
  "generate_achievement",
  "optimize_keywords",
  "suggest_missing_skills",
  "improve_grammar",
  "improve_readability",
  "reduce_repetition",
  "generate_internship",
  "generate_cover_letter",
  "generate_linkedin_about",
  "generate_portfolio_bio",
  "generate_github_bio",
  "humanize",
]);

export const aiGenerationRequestSchema = z.object({
  task: aiTaskTypeSchema,
  input: z.string().min(1).max(8000),
  context: z
    .object({
      targetRole: z.string().max(150).optional(),
      company: z.string().max(150).optional(),
      jobDescription: z.string().max(10000).optional(),
      tone: z
        .enum(["professional", "casual", "confident", "concise"])
        .optional(),
    })
    .optional(),
});

/**
 * Validates arbitrary content and returns a typed, safe result rather than
 * throwing. Use this at every service boundary.
 */
export function validate<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
):
  | { success: true; data: z.output<S> }
  | { success: false; errors: { path: string; message: string }[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
