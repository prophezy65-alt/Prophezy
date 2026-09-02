/**
 * lib/research/validation/search-query.validation.ts
 *
 * Dependency-free validation for PaperSearchQuery, mirroring the
 * pattern in lib/ai/utils/validator.ts. No zod dependency required;
 * swap in a zod adapter later if the rest of the app standardizes
 * on it without touching call sites.
 */

import type { PaperSearchQuery, SearchKind } from '../models/paper.types';
import { ResearchValidationError } from '../utils/errors';

const VALID_KINDS: SearchKind[] = [
  'keyword',
  'topic',
  'author',
  'doi',
  'institution',
  'conference',
  'journal',
];

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;

export function validatePaperSearchQuery(
  input: Partial<PaperSearchQuery>,
): PaperSearchQuery {
  const issues: string[] = [];

  if (!input.kind || !VALID_KINDS.includes(input.kind)) {
    issues.push(`kind must be one of: ${VALID_KINDS.join(', ')}`);
  }

  if (!input.query || typeof input.query !== 'string' || !input.query.trim()) {
    issues.push('query must be a non-empty string');
  }

  if (input.kind === 'doi' && input.query && !DOI_PATTERN.test(input.query.trim())) {
    issues.push('query does not look like a valid DOI (expected format 10.xxxx/...)');
  }

  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1) {
      issues.push('limit must be a positive integer');
    } else if (input.limit > MAX_LIMIT) {
      issues.push(`limit must not exceed ${MAX_LIMIT}`);
    }
  }

  if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
    issues.push('offset must be a non-negative integer');
  }

  const currentYear = new Date().getFullYear();
  if (input.fromYear !== undefined && (input.fromYear < 1800 || input.fromYear > currentYear + 1)) {
    issues.push(`fromYear must be between 1800 and ${currentYear + 1}`);
  }
  if (input.toYear !== undefined && (input.toYear < 1800 || input.toYear > currentYear + 1)) {
    issues.push(`toYear must be between 1800 and ${currentYear + 1}`);
  }
  if (
    input.fromYear !== undefined &&
    input.toYear !== undefined &&
    input.fromYear > input.toYear
  ) {
    issues.push('fromYear must not be after toYear');
  }

  if (issues.length > 0) {
    throw new ResearchValidationError('Invalid paper search query', issues);
  }

  return {
    kind: input.kind as SearchKind,
    query: input.query!.trim(),
    limit: input.limit ?? DEFAULT_LIMIT,
    offset: input.offset ?? 0,
    fromYear: input.fromYear,
    toYear: input.toYear,
    sources: input.sources,
  };
}
