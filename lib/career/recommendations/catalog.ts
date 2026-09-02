/**
 * catalog.ts
 * Static reference catalog of Roles, Industries, and Companies. This is
 * the deterministic backbone the matching/analytics utilities operate on;
 * AI Core is used to generate *personalized reasoning* on top of it, not
 * to invent the catalog itself. In production this catalog should move
 * into the database (career_roles / career_industries / career_companies
 * tables) so it can be maintained without a redeploy — see
 * `supabase/migrations` for optional starter tables.
 */

import { Role, Industry, Company } from "../models/career.model";

export const ROLE_CATALOG: Role[] = [
  {
    id: "role-swe",
    title: "Software Engineer",
    domain: "software",
    description: "Designs, builds, and maintains software systems and applications.",
    coreSkills: ["data structures", "algorithms", "git", "sql", "javascript"],
    niceToHaveSkills: ["typescript", "react", "system design", "docker"],
    seniorityLevels: ["fresher", "junior", "mid", "senior", "lead"],
    averageSalaryRangeUsd: [70000, 180000],
  },
  {
    id: "role-ds",
    title: "Data Scientist",
    domain: "data",
    description: "Analyzes data and builds models to drive business decisions.",
    coreSkills: ["python", "statistics", "sql", "machine learning"],
    niceToHaveSkills: ["deep learning", "data visualization", "a/b testing"],
    seniorityLevels: ["fresher", "junior", "mid", "senior"],
    averageSalaryRangeUsd: [75000, 190000],
  },
  {
    id: "role-ai",
    title: "AI Engineer",
    domain: "ai",
    description: "Builds and deploys machine learning and generative AI systems.",
    coreSkills: ["python", "machine learning", "deep learning", "pytorch"],
    niceToHaveSkills: ["transformers", "llms", "mlops", "vector databases"],
    seniorityLevels: ["junior", "mid", "senior", "lead"],
    averageSalaryRangeUsd: [85000, 210000],
  },
  {
    id: "role-devops",
    title: "DevOps Engineer",
    domain: "infrastructure",
    description: "Builds and maintains CI/CD pipelines and cloud infrastructure.",
    coreSkills: ["linux", "docker", "kubernetes", "ci/cd"],
    niceToHaveSkills: ["terraform", "aws", "monitoring"],
    seniorityLevels: ["junior", "mid", "senior", "lead"],
    averageSalaryRangeUsd: [75000, 185000],
  },
  {
    id: "role-pm",
    title: "Product Manager",
    domain: "product",
    description: "Defines product strategy and coordinates cross-functional execution.",
    coreSkills: ["product strategy", "prioritization", "user research", "analytics"],
    niceToHaveSkills: ["sql basics", "a/b testing", "wireframing"],
    seniorityLevels: ["junior", "mid", "senior", "lead"],
    averageSalaryRangeUsd: [80000, 200000],
  },
  {
    id: "role-ux",
    title: "UX Designer",
    domain: "design",
    description: "Designs usable, accessible product experiences.",
    coreSkills: ["figma", "user research", "wireframing", "prototyping"],
    niceToHaveSkills: ["design systems", "usability testing"],
    seniorityLevels: ["junior", "mid", "senior", "lead"],
    averageSalaryRangeUsd: [65000, 160000],
  },
  {
    id: "role-security",
    title: "Cybersecurity Analyst",
    domain: "security",
    description: "Protects systems and data from security threats.",
    coreSkills: ["networking", "security fundamentals", "linux"],
    niceToHaveSkills: ["penetration testing", "siem tools", "cloud security"],
    seniorityLevels: ["junior", "mid", "senior", "lead"],
    averageSalaryRangeUsd: [70000, 175000],
  },
];

export const INDUSTRY_CATALOG: Industry[] = [
  {
    id: "industry-software",
    name: "Software & Technology",
    description: "Companies building software products and platforms.",
    growthOutlook: "high-growth",
    emergingSkills: ["ai integration", "cloud-native development", "typescript"],
    relatedRoles: ["role-swe", "role-devops", "role-pm", "role-ux"],
  },
  {
    id: "industry-ai",
    name: "Artificial Intelligence",
    description: "Companies building AI/ML products, tooling, and infrastructure.",
    growthOutlook: "high-growth",
    emergingSkills: ["llms", "rag", "prompt engineering", "mlops"],
    relatedRoles: ["role-ai", "role-ds"],
  },
  {
    id: "industry-finance",
    name: "Finance & Fintech",
    description: "Banking, payments, and financial technology companies.",
    growthOutlook: "growing",
    emergingSkills: ["real-time data pipelines", "fraud detection ml"],
    relatedRoles: ["role-swe", "role-ds", "role-security"],
  },
  {
    id: "industry-healthcare",
    name: "Healthcare & HealthTech",
    description: "Companies improving healthcare delivery and outcomes with technology.",
    growthOutlook: "growing",
    emergingSkills: ["health data interoperability", "clinical ml"],
    relatedRoles: ["role-swe", "role-ds", "role-security"],
  },
  {
    id: "industry-ecommerce",
    name: "E-Commerce & Retail",
    description: "Companies selling goods/services through digital channels.",
    growthOutlook: "stable",
    emergingSkills: ["recommendation systems", "supply chain optimization"],
    relatedRoles: ["role-swe", "role-pm", "role-ux"],
  },
];

export const COMPANY_CATALOG: Company[] = [
  {
    id: "company-google",
    name: "Google",
    industry: "Software & Technology",
    size: "enterprise",
    hiringFocusAreas: ["software engineering", "ai/ml", "infrastructure"],
    knownForRoles: ["Software Engineer", "AI Engineer", "Product Manager"],
    interviewStyleNotes: "Emphasizes algorithmic problem solving, system design, and Googleyness/leadership.",
  },
  {
    id: "company-microsoft",
    name: "Microsoft",
    industry: "Software & Technology",
    size: "enterprise",
    hiringFocusAreas: ["cloud", "productivity software", "ai"],
    knownForRoles: ["Software Engineer", "DevOps Engineer", "Product Manager"],
    interviewStyleNotes: "Focuses on problem solving, collaboration, and growth mindset.",
  },
  {
    id: "company-amazon",
    name: "Amazon",
    industry: "E-Commerce & Retail",
    size: "enterprise",
    hiringFocusAreas: ["e-commerce", "cloud (AWS)", "logistics tech"],
    knownForRoles: ["Software Engineer", "DevOps Engineer", "Data Scientist"],
    interviewStyleNotes: "Heavily leadership-principle-driven; expect behavioral + technical rounds.",
  },
  {
    id: "company-meta",
    name: "Meta",
    industry: "Software & Technology",
    size: "enterprise",
    hiringFocusAreas: ["social platforms", "ai", "vr/ar"],
    knownForRoles: ["Software Engineer", "Data Scientist", "Product Manager"],
    interviewStyleNotes: "Strong emphasis on impact and execution speed.",
  },
  {
    id: "company-startup-generic",
    name: "Early-Stage Startup",
    industry: "Software & Technology",
    size: "startup",
    hiringFocusAreas: ["full-stack development", "rapid iteration"],
    knownForRoles: ["Software Engineer", "Product Manager", "UX Designer"],
    interviewStyleNotes: "Favors versatility, ownership, and shipping speed over specialization.",
  },
];

export function findRoleByTitle(title: string): Role | undefined {
  const normalized = title.trim().toLowerCase();
  return ROLE_CATALOG.find(
    (r) => r.title.toLowerCase() === normalized || r.title.toLowerCase().includes(normalized) || normalized.includes(r.title.toLowerCase())
  );
}

export function findIndustryByName(name: string): Industry | undefined {
  const normalized = name.trim().toLowerCase();
  return INDUSTRY_CATALOG.find((i) => i.name.toLowerCase() === normalized || i.name.toLowerCase().includes(normalized));
}

export function findCompanyByName(name: string): Company | undefined {
  const normalized = name.trim().toLowerCase();
  return COMPANY_CATALOG.find((c) => c.name.toLowerCase() === normalized);
}
