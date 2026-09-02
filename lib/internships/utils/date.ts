export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  if (typeof value === 'number') {
    // Heuristic: 10-digit values are seconds, 13-digit are milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000).toISOString();
    if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed)).toISOString();
    // Common non-ISO form: "2026-07-23 10:15:00"
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
      ? trimmed.replace(' ', 'T')
      : trimmed;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export function daysUntil(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  return (target - now.getTime()) / 86_400_000;
}

export function isExpired(deadlineAt: string | null, now = new Date()): boolean {
  const remaining = daysUntil(deadlineAt, now);
  return remaining !== null && remaining < 0;
}

export function isoNow(): string {
  return new Date().toISOString();
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Parses "3 months", "6-8 weeks", "12 week", "Summer 2026" into a month count. */
export function parseDurationMonths(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase();

  const range = text.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*(month|week|day)/);
  if (range) {
    const avg = (Number(range[1]) + Number(range[2])) / 2;
    return unitToMonths(avg, range[3] as string);
  }
  const single = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(month|week|day|year)/);
  if (single) return unitToMonths(Number(single[1]), single[2] as string);
  if (/summer|winter|semester/.test(text)) return 3;
  return null;
}

function unitToMonths(amount: number, unit: string): number {
  switch (unit) {
    case 'day': return Math.round((amount / 30) * 10) / 10;
    case 'week': return Math.round((amount / 4.345) * 10) / 10;
    case 'year': return amount * 12;
    default: return amount;
  }
}
