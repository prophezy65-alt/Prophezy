/**
 * resume-content.ts
 * Blank-content skeleton + merge helper. Used by the "create new resume"
 * flow (start from scratch) and the import flow (parsed content is a
 * Partial<ResumeContent> that needs merging onto a full skeleton before it
 * can be saved, since the DB/domain type requires every section present).
 */

import type {
  ResumeContent,
  SectionConfig,
  ResumeSectionType,
} from "../models/resume.model";

const DEFAULT_SECTION_ORDER: ResumeSectionType[] = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certificates",
  "achievements",
];

function defaultSectionOrder(): SectionConfig[] {
  return DEFAULT_SECTION_ORDER.map((type, order) => ({
    type,
    visible: true,
    order,
  }));
}

export function createEmptyResumeContent(fullName = ""): ResumeContent {
  return {
    contact: { fullName, links: [] },
    summary: {},
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certificates: [],
    achievements: [],
    sectionOrder: defaultSectionOrder(),
  };
}

/** Merges a Partial<ResumeContent> (e.g. from parseResumeFile) onto a blank
 *  skeleton so every required section is present. Partial arrays/objects
 *  from the parse simply replace the corresponding blank section. */
export function mergeIntoResumeContent(
  partial: Partial<ResumeContent>
): ResumeContent {
  const base = createEmptyResumeContent();
  return {
    contact: partial.contact ?? base.contact,
    summary: partial.summary ?? base.summary,
    experience: partial.experience ?? base.experience,
    education: partial.education ?? base.education,
    projects: partial.projects ?? base.projects,
    skills: partial.skills ?? base.skills,
    certificates: partial.certificates ?? base.certificates,
    achievements: partial.achievements ?? base.achievements,
    sectionOrder: partial.sectionOrder ?? base.sectionOrder,
  };
}

/** Generates a short client-side id for new section entries (experience,
 *  education, etc). Not a DB primary key — just needs to be unique within
 *  one resume's arrays for React keys + edit/remove targeting. */
export function newEntryId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
