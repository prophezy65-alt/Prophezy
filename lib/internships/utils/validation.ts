import { ValidationError } from './errors';

/**
 * Dependency-free shape validation, mirroring the approach already used by
 * `lib/ai/utils/validator.ts`. Swap for zod later without touching call sites.
 */

export type Validator<T> = (value: unknown, path: string) => T;

export function str(options: { min?: number; max?: number; optional?: boolean } = {}): Validator<string> {
  return (value, path) => {
    if (value === undefined || value === null || value === '') {
      if (options.optional) return '';
      throw new ValidationError(`${path} is required`);
    }
    if (typeof value !== 'string') throw new ValidationError(`${path} must be a string`);
    const trimmed = value.trim();
    if (options.min !== undefined && trimmed.length < options.min) {
      throw new ValidationError(`${path} must be at least ${options.min} characters`);
    }
    if (options.max !== undefined && trimmed.length > options.max) {
      throw new ValidationError(`${path} must be at most ${options.max} characters`);
    }
    return trimmed;
  };
}

export function num(options: { min?: number; max?: number; optional?: boolean } = {}): Validator<number | null> {
  return (value, path) => {
    if (value === undefined || value === null || value === '') {
      if (options.optional) return null;
      throw new ValidationError(`${path} is required`);
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new ValidationError(`${path} must be a number`);
    if (options.min !== undefined && parsed < options.min) {
      throw new ValidationError(`${path} must be >= ${options.min}`);
    }
    if (options.max !== undefined && parsed > options.max) {
      throw new ValidationError(`${path} must be <= ${options.max}`);
    }
    return parsed;
  };
}

export function bool(optional = true): Validator<boolean | null> {
  return (value, path) => {
    if (value === undefined || value === null || value === '') {
      if (optional) return null;
      throw new ValidationError(`${path} is required`);
    }
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new ValidationError(`${path} must be a boolean`);
  };
}

export function oneOf<T extends string>(allowed: readonly T[], optional = true): Validator<T | null> {
  return (value, path) => {
    if (value === undefined || value === null || value === '') {
      if (optional) return null;
      throw new ValidationError(`${path} is required`);
    }
    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      throw new ValidationError(`${path} must be one of: ${allowed.join(', ')}`);
    }
    return value as T;
  };
}

export function list<T>(inner: Validator<T>, max = 50): Validator<T[]> {
  return (value, path) => {
    if (value === undefined || value === null || value === '') return [];
    const arr = Array.isArray(value)
      ? value
      : String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (arr.length > max) throw new ValidationError(`${path} may contain at most ${max} entries`);
    return arr.map((item, i) => inner(item, `${path}[${i}]`));
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function requireUuid(value: unknown, path: string): string {
  const raw = str({ min: 36, max: 36 })(value, path);
  if (!isUuid(raw)) throw new ValidationError(`${path} must be a UUID`);
  return raw;
}

/** Strips control characters and prompt-injection framing before text reaches a model. */
export function sanitizeForPrompt(input: string, maxLength = 8_000): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/```/g, "'''")
    .replace(/^\s*(system|assistant|user)\s*:/gim, '$1 -')
    .replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi,
      '[filtered]')
    .slice(0, maxLength);
}
