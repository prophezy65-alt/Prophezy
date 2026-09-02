/**
 * resume.service.ts
 * Core orchestration for Resume Studio: create/update resumes, run
 * formatting + validation on save, manage version history, and diff
 * versions. This service is intentionally DB-agnostic: it depends on a
 * `ResumeRepository` interface rather than importing Supabase directly,
 * because the Database Backend is being built by another engineer.
 *
 * Wiring: once the DB engineer's repository is ready, implement
 * `ResumeRepository` against Supabase and inject it here. Until then,
 * `createInMemoryResumeRepository()` below can be used for local dev/tests.
 */

import {
  Resume,
  ResumeContent,
  ResumeVersion,
  VersionDiff,
  VersionDiffEntry,
  TemplateId,
  UserId,
  ResumeId,
  ServiceResult,
  success,
  failure,
} from "../models/resume.model";
import { formatResumeContent } from "../utils/resume-formatter";
import { validateResumeContent } from "../utils/resume-validator";

// ---------------------------------------------------------------------------
// Repository interface — implemented by the Database Backend engineer
// ---------------------------------------------------------------------------

export interface ResumeRepository {
  getResume(id: ResumeId): Promise<Resume | null>;
  listResumesForUser(userId: UserId): Promise<Resume[]>;
  saveResume(resume: Resume): Promise<Resume>;
  deleteResume(id: ResumeId): Promise<void>;

  saveVersion(version: ResumeVersion): Promise<ResumeVersion>;
  listVersions(resumeId: ResumeId): Promise<ResumeVersion[]>;
  getVersion(resumeId: ResumeId, version: number): Promise<ResumeVersion | null>;
}

// ---------------------------------------------------------------------------
// In-memory reference implementation (local dev / tests only)
// ---------------------------------------------------------------------------

export function createInMemoryResumeRepository(): ResumeRepository {
  const resumes = new Map<ResumeId, Resume>();
  const versions = new Map<ResumeId, ResumeVersion[]>();

  return {
    async getResume(id) {
      return resumes.get(id) ?? null;
    },
    async listResumesForUser(userId) {
      return [...resumes.values()].filter((r) => r.userId === userId);
    },
    async saveResume(resume) {
      resumes.set(resume.id, resume);
      return resume;
    },
    async deleteResume(id) {
      resumes.delete(id);
      versions.delete(id);
    },
    async saveVersion(version) {
      const list = versions.get(version.resumeId) ?? [];
      list.push(version);
      versions.set(version.resumeId, list);
      return version;
    },
    async listVersions(resumeId) {
      return versions.get(resumeId) ?? [];
    },
    async getVersion(resumeId, versionNumber) {
      const list = versions.get(resumeId) ?? [];
      return list.find((v) => v.version === versionNumber) ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

function generateId(): string {
  // resumes.id and resume_versions.id are Postgres `uuid` columns — must be
  // a real UUID, not an arbitrary string, or the insert fails with
  // "invalid input syntax for type uuid".
  return randomUUID();
}

export interface CreateResumeInput {
  userId: UserId;
  title: string;
  templateId: TemplateId;
  content: ResumeContent;
  targetRole?: string;
  targetJobDescription?: string;
}

export class ResumeService {
  constructor(private readonly repo: ResumeRepository) {}

  async createResume(input: CreateResumeInput): Promise<ServiceResult<Resume>> {
    const formatted = formatResumeContent(input.content);
    const validation = validateResumeContent(formatted);
    if (!validation.isValid) {
      return failure("VALIDATION_FAILED", "Resume content failed validation.", validation.issues);
    }

    const now = new Date().toISOString();
    const resume: Resume = {
      id: generateId(),
      userId: input.userId,
      title: input.title,
      templateId: input.templateId,
      content: formatted,
      targetRole: input.targetRole,
      targetJobDescription: input.targetJobDescription,
      createdAt: now,
      updatedAt: now,
      currentVersion: 1,
    };

    const saved = await this.repo.saveResume(resume);
    await this.repo.saveVersion({
      id: generateId(),
      resumeId: saved.id,
      version: 1,
      content: saved.content,
      label: "Initial version",
      createdAt: now,
      createdBy: input.userId,
    });

    return success(saved);
  }

  async updateResumeContent(
    resumeId: ResumeId,
    userId: UserId,
    newContent: ResumeContent,
    changeSummary?: string
  ): Promise<ServiceResult<Resume>> {
    const existing = await this.repo.getResume(resumeId);
    if (!existing) {
      return failure("NOT_FOUND", "Resume not found.");
    }
    if (existing.userId !== userId) {
      return failure("FORBIDDEN", "You do not have access to this resume.");
    }

    const formatted = formatResumeContent(newContent);
    const validation = validateResumeContent(formatted);
    if (!validation.isValid) {
      return failure("VALIDATION_FAILED", "Resume content failed validation.", validation.issues);
    }

    const nextVersion = existing.currentVersion + 1;
    const updated: Resume = {
      ...existing,
      content: formatted,
      updatedAt: new Date().toISOString(),
      currentVersion: nextVersion,
    };

    const saved = await this.repo.saveResume(updated);
    await this.repo.saveVersion({
      id: generateId(),
      resumeId: saved.id,
      version: nextVersion,
      content: saved.content,
      createdAt: saved.updatedAt,
      createdBy: userId,
      changeSummary,
    });

    return success(saved);
  }

  async getResume(resumeId: ResumeId): Promise<ServiceResult<Resume>> {
    const resume = await this.repo.getResume(resumeId);
    if (!resume) return failure("NOT_FOUND", "Resume not found.");
    return success(resume);
  }

  /**
   * Updates title/templateId/targetRole/targetJobDescription only. Unlike
   * updateResumeContent, this does NOT create a new resume_versions row —
   * version history tracks content changes, not metadata like the display
   * title or which JD a resume is being targeted at.
   */
  async updateResumeMeta(
    resumeId: ResumeId,
    userId: UserId,
    patch: {
      title?: string;
      templateId?: TemplateId;
      targetRole?: string;
      targetJobDescription?: string;
    }
  ): Promise<ServiceResult<Resume>> {
    const existing = await this.repo.getResume(resumeId);
    if (!existing) return failure("NOT_FOUND", "Resume not found.");
    if (existing.userId !== userId) {
      return failure("FORBIDDEN", "You do not have access to this resume.");
    }

    const updated: Resume = {
      ...existing,
      title: patch.title ?? existing.title,
      templateId: patch.templateId ?? existing.templateId,
      targetRole: patch.targetRole ?? existing.targetRole,
      targetJobDescription: patch.targetJobDescription ?? existing.targetJobDescription,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.repo.saveResume(updated);
    return success(saved);
  }

  async listResumes(userId: UserId): Promise<ServiceResult<Resume[]>> {
    const resumes = await this.repo.listResumesForUser(userId);
    return success(resumes);
  }

  async deleteResume(resumeId: ResumeId, userId: UserId): Promise<ServiceResult<null>> {
    const existing = await this.repo.getResume(resumeId);
    if (!existing) return failure("NOT_FOUND", "Resume not found.");
    if (existing.userId !== userId) return failure("FORBIDDEN", "You do not have access to this resume.");

    await this.repo.deleteResume(resumeId);
    return success(null);
  }


  async listVersions(resumeId: ResumeId): Promise<ServiceResult<ResumeVersion[]>> {
    const versions = await this.repo.listVersions(resumeId);
    return success(versions.sort((a, b) => b.version - a.version));
  }

  async restoreVersion(
    resumeId: ResumeId,
    userId: UserId,
    versionNumber: number
  ): Promise<ServiceResult<Resume>> {
    const target = await this.repo.getVersion(resumeId, versionNumber);
    if (!target) return failure("NOT_FOUND", "Version not found.");

    return this.updateResumeContent(
      resumeId,
      userId,
      target.content,
      `Restored from version ${versionNumber}`
    );
  }

  async compareVersions(
    resumeId: ResumeId,
    fromVersion: number,
    toVersion: number
  ): Promise<ServiceResult<VersionDiff>> {
    const [from, to] = await Promise.all([
      this.repo.getVersion(resumeId, fromVersion),
      this.repo.getVersion(resumeId, toVersion),
    ]);

    if (!from || !to) {
      return failure("NOT_FOUND", "One or both versions not found.");
    }

    const entries = diffResumeContent(from.content, to.content);
    return success<VersionDiff>({ fromVersion, toVersion, entries });
  }
}

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------

/**
 * Shallow, path-aware diff between two ResumeContent objects. Compares
 * bullet-level and field-level strings so the UI can show "changed this
 * line" rather than "the whole resume changed".
 */
export function diffResumeContent(a: ResumeContent, b: ResumeContent): VersionDiffEntry[] {
  const entries: VersionDiffEntry[] = [];

  diffField(entries, "contact.fullName", a.contact.fullName, b.contact.fullName);
  diffField(entries, "summary.summary", a.summary.summary, b.summary.summary);

  diffArrayField(
    entries,
    "experience",
    a.experience,
    b.experience,
    (e) => e.id,
    (e) => e.bullets.join("\n")
  );
  diffArrayField(
    entries,
    "projects",
    a.projects,
    b.projects,
    (p) => p.id,
    (p) => p.bullets.join("\n")
  );

  return entries;
}

function diffField(entries: VersionDiffEntry[], path: string, before?: string, after?: string): void {
  if ((before ?? "") === (after ?? "")) return;
  entries.push({
    path,
    changeType: !before ? "added" : !after ? "removed" : "modified",
    before,
    after,
  });
}

function diffArrayField<T>(
  entries: VersionDiffEntry[],
  sectionName: string,
  before: T[],
  after: T[],
  getId: (item: T) => string,
  getComparable: (item: T) => string
): void {
  const beforeMap = new Map(before.map((item) => [getId(item), item]));
  const afterMap = new Map(after.map((item) => [getId(item), item]));

  for (const [id, item] of afterMap) {
    const beforeItem = beforeMap.get(id);
    const path = `${sectionName}[${id}]`;
    if (!beforeItem) {
      entries.push({ path, changeType: "added", after: getComparable(item) });
    } else if (getComparable(beforeItem) !== getComparable(item)) {
      entries.push({
        path,
        changeType: "modified",
        before: getComparable(beforeItem),
        after: getComparable(item),
      });
    }
  }

  for (const [id, item] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({ path: `${sectionName}[${id}]`, changeType: "removed", before: getComparable(item) });
    }
  }
}
