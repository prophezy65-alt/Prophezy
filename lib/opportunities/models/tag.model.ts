/**
 * lib/opportunities/models/tag.model.ts
 *
 * Backs the `opportunity_tags` table: a normalized tag catalog (so
 * "React", "react", "React.js" collapse to one canonical tag) plus the
 * many-to-many assignment of tags to opportunities that powers technology
 * search and faceted filtering.
 */

import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export type TagCategory = "technology" | "category" | "skill" | "industry";

export interface Tag {
  readonly id: UUID;
  readonly slug: string; // canonical lowercase-kebab form, e.g. "react", "machine-learning"
  readonly displayName: string; // canonical display form, e.g. "React", "Machine Learning"
  readonly category: TagCategory;
  readonly synonyms: readonly string[]; // lowercase alternate spellings that normalize to this tag
  readonly usageCount: number; // denormalized count of opportunities using this tag, for facet sorting
}

export interface OpportunityTagAssignment {
  readonly opportunityId: UUID;
  readonly tagId: UUID;
  readonly assignedBy: "provider" | "normalizer" | "manual";
}

export function slugifyTag(rawTag: string): string {
  return rawTag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Builds a lookup from every known synonym (including the canonical slug itself) to its `Tag`, for fast normalization. */
export function buildSynonymIndex(tags: readonly Tag[]): Map<string, Tag> {
  const index = new Map<string, Tag>();
  for (const tag of tags) {
    index.set(tag.slug, tag);
    for (const synonym of tag.synonyms) {
      index.set(slugifyTag(synonym), tag);
    }
  }
  return index;
}

/** Resolves a raw provider-supplied tag string to its canonical `Tag`, or `null` if unknown (a new tag should then be created). */
export function resolveTag(rawTag: string, synonymIndex: ReadonlyMap<string, Tag>): Tag | null {
  return synonymIndex.get(slugifyTag(rawTag)) ?? null;
}

export function validateTag(tag: Tag): string[] {
  const problems: string[] = [];
  if (!isUUID(tag.id)) problems.push("Tag.id must be a UUID.");
  if (!isNonEmptyString(tag.slug)) problems.push("Tag.slug is required.");
  if (tag.slug !== slugifyTag(tag.slug)) problems.push(`Tag.slug "${tag.slug}" is not in canonical slug form.`);
  if (!isNonEmptyString(tag.displayName)) problems.push("Tag.displayName is required.");
  if (tag.usageCount < 0) problems.push("Tag.usageCount must be non-negative.");
  for (const synonym of tag.synonyms) {
    if (slugifyTag(synonym) === tag.slug) {
      problems.push(`Tag.synonyms contains "${synonym}", which is redundant with the canonical slug.`);
    }
  }
  return problems;
}

export function validateOpportunityTagAssignment(assignment: OpportunityTagAssignment): string[] {
  const problems: string[] = [];
  if (!isUUID(assignment.opportunityId)) problems.push("OpportunityTagAssignment.opportunityId must be a UUID.");
  if (!isUUID(assignment.tagId)) problems.push("OpportunityTagAssignment.tagId must be a UUID.");
  return problems;
}
