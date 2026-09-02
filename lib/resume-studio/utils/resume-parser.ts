/**
 * resume-parser.ts
 * Pure text -> structured-content extraction. Takes raw text (already
 * extracted from PDF/DOCX/OCR by parser.service.ts) and pulls out contact
 * info, links, and best-guess section boundaries using heuristics/regex.
 *
 * This is intentionally regex/heuristic based (no AI call) so parsing is
 * instant and free. parser.service.ts optionally refines the result with
 * Gemini for messy/unusual formats.
 */

import {
  ResumeContent,
  ContactInfo,
  Link,
  ExperienceEntry,
  EducationEntry,
  SkillGroup,
} from "../models/resume.model";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL_REGEX = /(https?:\/\/[^\s,]+|(?:www\.)?(?:linkedin\.com|github\.com)[^\s,]+)/gi;

const SECTION_HEADERS: Record<string, RegExp> = {
  summary: /^(summary|objective|profile|about)\b/i,
  experience: /^(experience|work experience|employment history|professional experience)\b/i,
  education: /^(education|academic background)\b/i,
  projects: /^(projects|personal projects|academic projects)\b/i,
  skills: /^(skills|technical skills|technologies|core competencies)\b/i,
  certificates: /^(certificates|certifications|licenses)\b/i,
  achievements: /^(achievements|awards|honors)\b/i,
};

function extractLinks(text: string): Link[] {
  const matches = text.match(URL_REGEX) ?? [];
  const unique = [...new Set(matches)];
  return unique.map((url) => {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    let type: Link["type"] = "other";
    if (/github\.com/i.test(url)) type = "github";
    else if (/linkedin\.com/i.test(url)) type = "linkedin";
    return { label: type === "other" ? "Website" : type, url: normalized, type };
  });
}

function extractContact(text: string): ContactInfo {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullName = lines[0]?.length && lines[0].length < 60 ? lines[0] : "";

  const emailMatch = text.match(EMAIL_REGEX);
  const phoneMatch = text.match(PHONE_REGEX);
  const links = extractLinks(text);

  return {
    fullName,
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    links,
  };
}

/**
 * Splits raw resume text into named sections based on header line matches.
 * Returns a map of section name -> raw block text.
 */
export function splitIntoSections(text: string): Record<string, string> {
  const lines = text.split("\n");
  const sections: Record<string, string[]> = {};
  let currentSection = "header";
  sections[currentSection] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const matchedSection = Object.entries(SECTION_HEADERS).find(([, regex]) =>
      regex.test(trimmed)
    );

    if (matchedSection && trimmed.length < 40) {
      currentSection = matchedSection[0];
      sections[currentSection] = sections[currentSection] ?? [];
      continue;
    }

    sections[currentSection] = sections[currentSection] ?? [];
    sections[currentSection]!.push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, val]) => [key, val.join("\n").trim()])
  );
}

function parseSkillsBlock(block: string): SkillGroup[] {
  if (!block) return [];
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups: SkillGroup[] = [];
  let idx = 0;

  for (const line of lines) {
    const colonSplit = line.split(":");
    if (colonSplit.length === 2) {
      groups.push({
        id: `skill-${idx++}`,
        category: colonSplit[0]!.trim(),
        items: colonSplit[1]!.split(/[,•]/).map((s) => s.trim()).filter(Boolean),
      });
    } else {
      groups.push({
        id: `skill-${idx++}`,
        category: "Skills",
        items: line.split(/[,•]/).map((s) => s.trim()).filter(Boolean),
      });
    }
  }

  return groups;
}

function parseExperienceBlock(block: string): ExperienceEntry[] {
  if (!block) return [];
  // Heuristic: split on blank lines into entries; first line = "Role, Company"
  const chunks = block.split(/\n{2,}/).filter((c) => c.trim());
  return chunks.map((chunk, i) => {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const header = lines[0] ?? "";
    const [rolePart, companyPart] = header.split(/,|\|| at /i);
    const bullets = lines.slice(1).map((l) => l.replace(/^[-•*]\s*/, "")).filter(Boolean);

    return {
      id: `exp-${i}`,
      role: (rolePart ?? "Role").trim(),
      company: (companyPart ?? "Company").trim(),
      dateRange: { start: "", end: null, isCurrent: false },
      bullets,
    };
  });
}

function parseEducationBlock(block: string): EducationEntry[] {
  if (!block) return [];
  const chunks = block.split(/\n{2,}/).filter((c) => c.trim());
  return chunks.map((chunk, i) => {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const header = lines[0] ?? "";
    const [degreePart, institutionPart] = header.split(/,|\|/);

    return {
      id: `edu-${i}`,
      degree: (degreePart ?? "Degree").trim(),
      institution: (institutionPart ?? "Institution").trim(),
      dateRange: { start: "", end: null, isCurrent: false },
    };
  });
}

/**
 * Best-effort conversion of raw extracted text into partial ResumeContent.
 * Always returns a result — never throws — since parsed resumes are messy
 * by nature and downstream code should treat this as a starting draft.
 */
export function parseResumeText(text: string): Partial<ResumeContent> {
  const sections = splitIntoSections(text);
  const contact = extractContact(sections.header || text);

  return {
    contact,
    summary: { summary: sections.summary || undefined },
    experience: parseExperienceBlock(sections.experience || ""),
    education: parseEducationBlock(sections.education || ""),
    skills: parseSkillsBlock(sections.skills || ""),
    projects: [],
    certificates: [],
    achievements: [],
  };
}
