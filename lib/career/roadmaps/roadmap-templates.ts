/**
 * roadmap-templates.ts
 * Static, deterministic fallback roadmaps for common roles. Used when the
 * AI Core Engine is unavailable/rate-limited, or as a fast "instant
 * preview" before the personalized AI roadmap finishes generating.
 * roadmap.service.ts merges these with AI output via
 * `utils/roadmap-generator.ts#mergeWithFallback`.
 */

import { RoadmapMilestone } from "../models/career.model";

function milestone(
  id: string,
  title: string,
  description: string,
  estimatedWeeks: number,
  skillsCovered: string[],
  recommendedResources: string[],
  order: number
): RoadmapMilestone {
  return { id, title, description, estimatedWeeks, skillsCovered, recommendedResources, order };
}

export const ROADMAP_TEMPLATES: Record<string, RoadmapMilestone[]> = {
  "software engineer": [
    milestone("swe-1", "Programming Fundamentals", "Solidify core programming concepts: data structures, algorithms, and problem solving.", 4, ["data structures", "algorithms", "problem solving"], ["NeetCode 150", "CS50"], 0),
    milestone("swe-2", "Version Control & Collaboration", "Learn Git workflows, code review practices, and collaborative development.", 1, ["git", "github", "code review"], ["Pro Git book"], 1),
    milestone("swe-3", "Web Fundamentals", "Build a solid foundation in HTTP, REST APIs, and a modern web framework.", 4, ["http", "rest apis", "javascript", "react"], ["The Odin Project"], 2),
    milestone("swe-4", "Databases", "Understand relational databases, SQL, and basic schema design.", 2, ["sql", "postgresql", "database design"], ["Mode SQL Tutorial"], 3),
    milestone("swe-5", "System Design Basics", "Learn to reason about scalability, caching, and API design at a junior level.", 3, ["system design", "caching", "api design"], ["Grokking the System Design Interview"], 4),
    milestone("swe-6", "Build & Ship Projects", "Ship 2-3 full-stack projects with real deployments to build a portfolio.", 6, ["deployment", "full-stack development"], ["Vercel", "Railway"], 5),
    milestone("swe-7", "Interview Preparation", "Practice data structures/algorithms interviews and behavioral interviews.", 4, ["interviewing", "algorithms"], ["LeetCode", "Pramp"], 6),
  ],
  "data scientist": [
    milestone("ds-1", "Statistics & Probability", "Build a strong statistics foundation: distributions, hypothesis testing, inference.", 4, ["statistics", "probability"], ["StatQuest"], 0),
    milestone("ds-2", "Python for Data Science", "Master pandas, numpy, and data wrangling.", 3, ["python", "pandas", "numpy"], ["Kaggle Learn"], 1),
    milestone("ds-3", "Machine Learning Fundamentals", "Learn core ML algorithms and evaluation techniques.", 6, ["machine learning", "scikit-learn"], ["Andrew Ng ML Course"], 2),
    milestone("ds-4", "Data Visualization & Storytelling", "Learn to communicate insights with matplotlib/seaborn/Tableau.", 2, ["data visualization", "storytelling"], ["Storytelling with Data"], 3),
    milestone("ds-5", "SQL & Data Engineering Basics", "Query and prepare data at scale.", 3, ["sql", "etl"], ["Mode SQL Tutorial"], 4),
    milestone("ds-6", "Portfolio Projects", "Complete 2-3 end-to-end analysis/ML projects with writeups.", 5, ["end-to-end ml", "portfolio"], ["Kaggle competitions"], 5),
  ],
  "ai engineer": [
    milestone("ai-1", "Python & ML Foundations", "Strengthen Python and classical ML fundamentals.", 4, ["python", "machine learning"], ["fast.ai"], 0),
    milestone("ai-2", "Deep Learning", "Learn neural networks, CNNs, RNNs, and training practices.", 6, ["deep learning", "pytorch"], ["Deep Learning Specialization"], 1),
    milestone("ai-3", "LLMs & Transformers", "Understand transformer architecture, fine-tuning, and prompting.", 5, ["transformers", "llms", "prompt engineering"], ["Hugging Face course"], 2),
    milestone("ai-4", "MLOps Basics", "Learn model deployment, versioning, and monitoring.", 3, ["mlops", "model deployment"], ["Made With ML"], 3),
    milestone("ai-5", "Applied AI Projects", "Build 2-3 projects using real LLM/ML pipelines end-to-end.", 6, ["applied ai", "rag", "vector databases"], ["LangChain docs"], 4),
  ],
  "product manager": [
    milestone("pm-1", "PM Fundamentals", "Learn product lifecycle, discovery, and prioritization frameworks.", 3, ["product strategy", "prioritization"], ["Inspired by Marty Cagan"], 0),
    milestone("pm-2", "User Research", "Learn qualitative/quantitative research methods.", 2, ["user research", "interviews"], ["Continuous Discovery Habits"], 1),
    milestone("pm-3", "Metrics & Analytics", "Learn to define and track product metrics.", 2, ["analytics", "sql basics"], ["Lean Analytics"], 2),
    milestone("pm-4", "Case Studies & Portfolio", "Build 2-3 product case studies for interviews.", 4, ["case studies", "storytelling"], ["Exponent PM"], 3),
  ],
};

/**
 * Fuzzy-matches a target role string to the closest static template key.
 */
export function findFallbackRoadmap(targetRole: string): RoadmapMilestone[] | null {
  const normalized = targetRole.trim().toLowerCase();
  if (ROADMAP_TEMPLATES[normalized]) return ROADMAP_TEMPLATES[normalized];

  const partialKey = Object.keys(ROADMAP_TEMPLATES).find(
    (key) => normalized.includes(key) || key.includes(normalized)
  );
  return partialKey ? (ROADMAP_TEMPLATES[partialKey] ?? null) : null;
}
