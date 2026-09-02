import { FX_TO_INR, PERIOD_TO_MONTHLY } from '../config/constants';
import type { Compensation, Currency, StipendPeriod } from '../types';

const CURRENCY_SYMBOLS: Array<[RegExp, Currency]> = [
  [/₹|\brs\.?\b|\binr\b|rupee/i, 'INR'],
  [/\$|\busd\b|\bdollar/i, 'USD'],
  [/€|\beur\b/i, 'EUR'],
  [/£|\bgbp\b|\bpound/i, 'GBP'],
  [/\bsgd\b|s\$/i, 'SGD'],
  [/\baud\b|a\$/i, 'AUD'],
  [/\bcad\b|c\$/i, 'CAD'],
  [/\baed\b|\bdirham/i, 'AED'],
  [/¥|\bjpy\b/i, 'JPY'],
  [/\bchf\b/i, 'CHF'],
];

const PERIOD_PATTERNS: Array<[RegExp, StipendPeriod]> = [
  [/per\s*hour|\/\s*hr|hourly|\bp\.?h\b/i, 'hour'],
  [/per\s*day|\/\s*day|daily/i, 'day'],
  [/per\s*week|\/\s*wk|weekly/i, 'week'],
  [/per\s*month|\/\s*mo|monthly|p\.?m\b/i, 'month'],
  [/per\s*(annum|year)|\/\s*yr|annually|\bpa\b/i, 'year'],
  [/lump\s*sum|total|one[- ]time/i, 'total'],
];

export function emptyCompensation(raw: string | null = null): Compensation {
  return {
    min: null, max: null, currency: null, period: null,
    isUnpaid: false, normalizedMonthlyInr: null, raw,
  };
}

/** Expands Indian shorthand: 25k -> 25000, 1.2 lakh -> 120000, 1 cr -> 10000000. */
function expandMagnitude(value: number, suffix: string | undefined): number {
  if (!suffix) return value;
  const s = suffix.toLowerCase();
  if (s.startsWith('k')) return value * 1_000;
  if (s.startsWith('l')) return value * 100_000;
  if (s.startsWith('cr')) return value * 10_000_000;
  if (s.startsWith('m')) return value * 1_000_000;
  return value;
}

export function parseCompensation(raw: string | null | undefined): Compensation {
  if (!raw) return emptyCompensation(null);
  // Strip thousands separators only (25,000 -> 25000); other commas become spaces
  // so that "₹20,000, ₹30,000" still yields two distinct figures.
  const text = raw
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return emptyCompensation(raw);

  if (/\bunpaid\b|\bno stipend\b|\bnot paid\b|\bvoluntary\b/i.test(text)) {
    return { ...emptyCompensation(raw), min: 0, max: 0, isUnpaid: true, normalizedMonthlyInr: 0 };
  }

  const currency = CURRENCY_SYMBOLS.find(([re]) => re.test(text))?.[1] ?? null;
  const period = PERIOD_PATTERNS.find(([re]) => re.test(text))?.[1] ?? null;

  const numberRe = /(\d+(?:\.\d+)?)\s*(k|lakh|lac|l|cr|crore|m|mn)?/gi;
  const found: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = numberRe.exec(text)) !== null) {
    const value = expandMagnitude(Number(match[1]), match[2]);
    // Hourly and daily rates are legitimately small (\$30/hr), so the noise floor
    // has to follow the period rather than assume a monthly figure.
    const floor = period === 'hour' || period === 'day' ? 1 : 100;
    if (value >= floor && !/^20\d{2}$/.test(match[1] as string)) found.push(value);
    if (found.length >= 4) break;
  }

  if (found.length === 0) return emptyCompensation(raw);

  const min = Math.min(...found);
  const max = Math.max(...found);
  const resolved: Compensation = {
    min,
    max: max === min ? null : max,
    currency,
    period,
    isUnpaid: false,
    normalizedMonthlyInr: null,
    raw,
  };
  resolved.normalizedMonthlyInr = toMonthlyInr(resolved);
  return resolved;
}

export function buildCompensation(
  min: number | null,
  max: number | null,
  currency: Currency | null,
  period: StipendPeriod | null,
  raw: string | null = null,
): Compensation {
  const comp: Compensation = {
    min, max, currency, period,
    isUnpaid: min === 0 && (max === 0 || max === null),
    normalizedMonthlyInr: null,
    raw,
  };
  comp.normalizedMonthlyInr = toMonthlyInr(comp);
  return comp;
}

/** Converts any compensation into a comparable INR-per-month figure. */
export function toMonthlyInr(comp: Compensation): number | null {
  if (comp.isUnpaid) return 0;
  const amount = comp.max !== null && comp.min !== null
    ? (comp.min + comp.max) / 2
    : comp.min ?? comp.max;
  if (amount === null) return null;

  const currency = comp.currency ?? 'INR';
  const period = comp.period ?? inferPeriod(amount, currency);
  const fx = FX_TO_INR[currency];
  return Math.round(amount * fx * PERIOD_TO_MONTHLY[period]);
}

/** When a provider omits the period, magnitude is the best available signal. */
function inferPeriod(amount: number, currency: Currency): StipendPeriod {
  const inr = amount * FX_TO_INR[currency];
  if (inr > 800_000) return 'year';
  if (inr < 2_000) return 'day';
  return 'month';
}

export function formatCompensation(comp: Compensation): string {
  if (comp.isUnpaid) return 'Unpaid';
  if (comp.min === null && comp.max === null) return 'Not disclosed';
  const cur = comp.currency ?? 'INR';
  const per = comp.period ?? 'month';
  const range = comp.max !== null && comp.max !== comp.min
    ? `${comp.min?.toLocaleString('en-IN')}–${comp.max.toLocaleString('en-IN')}`
    : `${(comp.min ?? comp.max)?.toLocaleString('en-IN')}`;
  return `${cur} ${range} / ${per}`;
}
