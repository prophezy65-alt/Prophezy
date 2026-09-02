/**
 * resume-keywords.ts
 * Keyword extraction and JD-matching. Pure string/NLP-lite logic — no AI
 * call required, so it's used both standalone and as pre-processing input
 * fed into the Gemini-based ATS/optimizer services.
 */

import { ResumeContent } from "../models/resume.model";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "a", "an", "of", "to", "in", "on", "is",
  "are", "as", "by", "or", "at", "be", "this", "that", "will", "we", "you",
  "your", "our", "have", "has", "from", "it", "its", "their", "into",
  "including", "etc", "such", "who", "which", "using", "use", "used",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Extracts candidate keywords/skills from a job description using
 * frequency + simple heuristics (capitalized terms, known tech tokens).
 */
export function extractKeywordsFromText(text: string, limit = 40): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();

  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  // Also capture common multi-word tech phrases via a small phrase list scan
  const phrasePatterns = [
    /machine learning/g, /data structures/g, /system design/g,
    /rest api/g, /ci\/cd/g, /unit testing/g, /object[- ]oriented/g,
    /cloud computing/g, /version control/g, /agile\/scrum/g,
  ];
  for (const pattern of phrasePatterns) {
    const matches = text.toLowerCase().match(pattern);
    if (matches) {
      freq.set(matches[0], (freq.get(matches[0]) ?? 0) + matches.length * 2);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

/** Flattens every piece of text content in a resume into a single lowercase string. */
export function flattenResumeText(content: ResumeContent): string {
  const parts: string[] = [];

  parts.push(content.contact?.fullName ?? "");
  parts.push(content.summary?.headline ?? "", content.summary?.summary ?? "");

  content.experience?.forEach((e) => {
    parts.push(e.company, e.role, ...(e.bullets ?? []), ...(e.techStack ?? []));
  });
  content.projects?.forEach((p) => {
    parts.push(p.name, p.description ?? "", ...(p.bullets ?? []), ...(p.techStack ?? []));
  });
  content.education?.forEach((e) => {
    parts.push(e.institution, e.degree, e.fieldOfStudy ?? "");
  });
  content.skills?.forEach((s) => parts.push(s.category, ...(s.items ?? [])));
  content.certificates?.forEach((c) => parts.push(c.name, c.issuer ?? ""));
  content.achievements?.forEach((a) => parts.push(a.title, a.description ?? ""));

  return parts.join(" ").toLowerCase();
}

export interface KeywordMatchResult {
  matched: string[];
  missing: string[];
  matchPercentage: number;
}

/**
 * Compares extracted JD keywords against resume text and returns matched /
 * missing keyword lists plus a match percentage — the core ATS keyword signal.
 */
export function matchKeywords(
  resumeContent: ResumeContent,
  jobDescription: string
): KeywordMatchResult {
  const jdKeywords = extractKeywordsFromText(jobDescription);
  const resumeText = flattenResumeText(resumeContent);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of jdKeywords) {
    if (resumeText.includes(keyword)) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const matchPercentage =
    jdKeywords.length === 0 ? 100 : Math.round((matched.length / jdKeywords.length) * 100);

  return { matched, missing, matchPercentage };
}
