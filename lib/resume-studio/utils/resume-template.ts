/**
 * resume-template.ts
 * Registry of available resume templates and their layout metadata.
 * The actual rendering (PDF/HTML) is done by generator.service.ts, which
 * reads this config to decide fonts, spacing, column layout, and accent color.
 */

import { TemplateId } from "../models/resume.model";

export type LayoutStyle = "single-column" | "two-column" | "sidebar";

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  description: string;
  layout: LayoutStyle;
  fontFamily: string;
  accentColor: string;
  atsFriendly: boolean;
  recommendedFor: string[];
}

export const TEMPLATE_REGISTRY: Record<TemplateId, TemplateDefinition> = {
  professional: {
    id: "professional",
    name: "Professional",
    description: "Clean single-column layout, safe for any industry.",
    layout: "single-column",
    fontFamily: "Georgia, serif",
    accentColor: "#1E3A5F",
    atsFriendly: true,
    recommendedFor: ["general", "corporate", "finance"],
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Sans-serif, subtle color accents, two-column skills row.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#2563EB",
    atsFriendly: true,
    recommendedFor: ["tech", "startup", "design"],
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Maximum whitespace, no color, pure typography.",
    layout: "single-column",
    fontFamily: "Helvetica, Arial, sans-serif",
    accentColor: "#111111",
    atsFriendly: true,
    recommendedFor: ["academic", "conservative industries"],
  },
  google: {
    id: "google",
    name: "Google Style",
    description: "Compact, metrics-forward, engineering-resume style.",
    layout: "single-column",
    fontFamily: "Arial, sans-serif",
    accentColor: "#4285F4",
    atsFriendly: true,
    recommendedFor: ["software-engineer", "swe-intern"],
  },
  microsoft: {
    id: "microsoft",
    name: "Microsoft Style",
    description: "Structured section headers, corporate-tech tone.",
    layout: "single-column",
    fontFamily: "Segoe UI, Arial, sans-serif",
    accentColor: "#0078D4",
    atsFriendly: true,
    recommendedFor: ["software-engineer", "pm"],
  },
  amazon: {
    id: "amazon",
    name: "Amazon Style",
    description: "Leadership-principle-friendly bullet structure.",
    layout: "single-column",
    fontFamily: "Amazon Ember, Arial, sans-serif",
    accentColor: "#FF9900",
    atsFriendly: true,
    recommendedFor: ["software-engineer", "operations"],
  },
  meta: {
    id: "meta",
    name: "Meta Style",
    description: "Impact-first bullets, modern sans-serif.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#0866FF",
    atsFriendly: true,
    recommendedFor: ["software-engineer", "data-scientist"],
  },
  apple: {
    id: "apple",
    name: "Apple Style",
    description: "Refined, minimal, generous whitespace.",
    layout: "single-column",
    fontFamily: "San Francisco, Helvetica, sans-serif",
    accentColor: "#000000",
    atsFriendly: true,
    recommendedFor: ["design", "software-engineer"],
  },
  academic: {
    id: "academic",
    name: "Academic",
    description: "Publication/CV-style, supports long-form sections.",
    layout: "single-column",
    fontFamily: "Times New Roman, serif",
    accentColor: "#1F2937",
    atsFriendly: true,
    recommendedFor: ["academia", "PhD"],
  },
  research: {
    id: "research",
    name: "Research",
    description: "Emphasizes publications, grants, research experience.",
    layout: "single-column",
    fontFamily: "Times New Roman, serif",
    accentColor: "#374151",
    atsFriendly: true,
    recommendedFor: ["research", "PhD", "masters"],
  },
  student: {
    id: "student",
    name: "Student",
    description: "Coursework and projects emphasized over experience.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#059669",
    atsFriendly: true,
    recommendedFor: ["student", "fresher"],
  },
  fresher: {
    id: "fresher",
    name: "Fresher",
    description: "Projects and skills first; short experience section.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#7C3AED",
    atsFriendly: true,
    recommendedFor: ["fresher", "entry-level"],
  },
  "ai-engineer": {
    id: "ai-engineer",
    name: "AI Engineer",
    description: "Highlights ML stack, model work, research links.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#DB2777",
    atsFriendly: true,
    recommendedFor: ["ai-engineer", "ml-engineer"],
  },
  "software-engineer": {
    id: "software-engineer",
    name: "Software Engineer",
    description: "Balanced experience/projects, tech-stack tags per role.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#2563EB",
    atsFriendly: true,
    recommendedFor: ["software-engineer"],
  },
  "data-scientist": {
    id: "data-scientist",
    name: "Data Scientist",
    description: "Emphasizes metrics, models, datasets, and impact.",
    layout: "single-column",
    fontFamily: "Inter, sans-serif",
    accentColor: "#0891B2",
    atsFriendly: true,
    recommendedFor: ["data-scientist", "ml"],
  },
};

export function getTemplate(id: TemplateId): TemplateDefinition {
  const template = TEMPLATE_REGISTRY[id];
  if (!template) {
    throw new Error(`Unknown template id: ${id}`);
  }
  return template;
}

export function listTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY);
}

export function recommendTemplates(targetRole?: string): TemplateDefinition[] {
  if (!targetRole) return listTemplates().filter((t) => t.atsFriendly).slice(0, 3);
  const role = targetRole.toLowerCase();
  const matches = listTemplates().filter((t) =>
    t.recommendedFor.some((r) => role.includes(r.replace("-", " ")) || r.includes(role))
  );
  return matches.length ? matches : listTemplates().filter((t) => t.atsFriendly).slice(0, 3);
}
