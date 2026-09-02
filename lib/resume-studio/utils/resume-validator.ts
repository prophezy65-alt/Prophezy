/**
 * resume-validator.ts
 * Business-rule validation that goes beyond zod shape-checking:
 * date ordering, empty-section warnings, duplicate detection.
 */

import { ResumeContent, DateRange } from "../models/resume.model";
import { resumeContentSchema, validate } from "../validation/resume.validation";

export interface ValidationIssue {
  path: string;
  severity: "error" | "warning";
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
}

function parseMonth(value?: string | null): number | null {
  if (!value) return null;
  // Accept "YYYY-MM" or "YYYY"
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = match[2] ? parseInt(match[2], 10) : 1;
  return year * 12 + month;
}

function checkDateRange(
  range: DateRange,
  path: string,
  issues: ValidationIssue[]
): void {
  const start = parseMonth(range.start);
  const end = range.isCurrent ? null : parseMonth(range.end ?? undefined);

  if (start === null) {
    issues.push({
      path: `${path}.start`,
      severity: "warning",
      message: `Could not parse start date "${range.start}". Use YYYY-MM format.`,
    });
    return;
  }

  if (!range.isCurrent && range.end && end !== null && end < start) {
    issues.push({
      path,
      severity: "error",
      message: "End date is before start date.",
    });
  }
}

/**
 * Runs schema validation plus semantic checks and returns a unified report.
 */
export function validateResumeContent(content: ResumeContent): ValidationReport {
  const issues: ValidationIssue[] = [];

  const schemaResult = validate(resumeContentSchema, content);
  if (!schemaResult.success) {
    for (const err of schemaResult.errors) {
      issues.push({ path: err.path, severity: "error", message: err.message });
    }
  }

  // Contact essentials
  if (!content.contact?.email && !content.contact?.phone) {
    issues.push({
      path: "contact",
      severity: "warning",
      message: "No email or phone provided; recruiters may not be able to reach you.",
    });
  }

  // Date sanity checks
  content.experience?.forEach((exp, i) =>
    checkDateRange(exp.dateRange, `experience[${i}].dateRange`, issues)
  );
  content.education?.forEach((edu, i) =>
    checkDateRange(edu.dateRange, `education[${i}].dateRange`, issues)
  );

  // Empty-section warnings
  if (!content.experience?.length && !content.projects?.length) {
    issues.push({
      path: "experience|projects",
      severity: "warning",
      message: "Resume has no experience or projects. Add at least one.",
    });
  }
  if (!content.skills?.length) {
    issues.push({
      path: "skills",
      severity: "warning",
      message: "No skills listed. ATS systems weight skills heavily.",
    });
  }

  // Duplicate bullet detection (weak content signal)
  const allBullets = [
    ...(content.experience?.flatMap((e) => e.bullets) ?? []),
    ...(content.projects?.flatMap((p) => p.bullets) ?? []),
  ];
  const seen = new Set<string>();
  allBullets.forEach((bullet) => {
    const normalized = bullet.trim().toLowerCase();
    if (seen.has(normalized)) {
      issues.push({
        path: "bullets",
        severity: "warning",
        message: `Duplicate bullet detected: "${bullet.slice(0, 60)}..."`,
      });
    }
    seen.add(normalized);
  });

  const hasError = issues.some((i) => i.severity === "error");
  return { isValid: !hasError, issues };
}
