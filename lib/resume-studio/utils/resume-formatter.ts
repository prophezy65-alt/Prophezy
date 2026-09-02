/**
 * resume-formatter.ts
 * Normalizes resume content: consistent capitalization, punctuation,
 * whitespace, bullet formatting, and phone/date formatting. Runs before
 * save and before export so output is always clean regardless of source
 * (manual typing, parsed upload, or AI generation).
 */

import { ResumeContent, DateRange } from "../models/resume.model";

export function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function ensureSentenceCase(text: string): string {
  const trimmed = cleanWhitespace(text);
  if (!trimmed) return trimmed;
  return trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

export function ensureTerminalPunctuation(text: string): string {
  const trimmed = cleanWhitespace(text);
  if (!trimmed) return trimmed;
  const last = trimmed[trimmed.length - 1]!;
  if (![".", "!", "?"].includes(last)) {
    return trimmed; // bullets intentionally omit periods in most modern resumes
  }
  return trimmed;
}

export function formatBullet(bullet: string): string {
  let text = cleanWhitespace(bullet);
  text = text.replace(/^[-•*]\s*/, ""); // strip leading bullet chars if user typed them
  text = ensureSentenceCase(text);
  // Strip trailing period for consistency across bullets (common resume style)
  text = text.replace(/\.$/, "");
  return text;
}

export function formatPhone(phone?: string): string | undefined {
  if (!phone) return phone;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}

export function formatDateRange(range: DateRange): string {
  const start = formatMonthLabel(range.start);
  if (range.isCurrent) return `${start} – Present`;
  const end = range.end ? formatMonthLabel(range.end) : "";
  return end ? `${start} – ${end}` : start;
}

function formatMonthLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIndex = parseInt(match[2]!, 10) - 1;
  const monthLabel = months[monthIndex] ?? match[2];
  return `${monthLabel} ${match[1]}`;
}

/**
 * Applies consistent formatting rules across an entire resume's content.
 * Safe to call repeatedly (idempotent).
 */
export function formatResumeContent(content: ResumeContent): ResumeContent {
  return {
    ...content,
    contact: {
      ...content.contact,
      fullName: cleanWhitespace(content.contact.fullName),
      phone: formatPhone(content.contact.phone),
      location: content.contact.location ? cleanWhitespace(content.contact.location) : content.contact.location,
    },
    summary: {
      headline: content.summary.headline ? cleanWhitespace(content.summary.headline) : content.summary.headline,
      summary: content.summary.summary ? ensureSentenceCase(content.summary.summary) : content.summary.summary,
    },
    experience: content.experience.map((e) => ({
      ...e,
      company: cleanWhitespace(e.company),
      role: cleanWhitespace(e.role),
      bullets: e.bullets.map(formatBullet),
    })),
    projects: content.projects.map((p) => ({
      ...p,
      name: cleanWhitespace(p.name),
      bullets: p.bullets.map(formatBullet),
    })),
    education: content.education.map((edu) => ({
      ...edu,
      institution: cleanWhitespace(edu.institution),
      degree: cleanWhitespace(edu.degree),
    })),
    skills: content.skills.map((s) => ({
      ...s,
      category: cleanWhitespace(s.category),
      items: s.items.map((i) => cleanWhitespace(i)),
    })),
  };
}
