import type { LocationSpec, WorkMode } from '../types';
import { collapseWhitespace } from './text';

const COUNTRY_ALIASES: Record<string, string> = {
  india: 'IN', bharat: 'IN', in: 'IN',
  'united states': 'US', usa: 'US', us: 'US', 'u.s.': 'US', america: 'US',
  'united kingdom': 'GB', uk: 'GB', england: 'GB', britain: 'GB', gb: 'GB',
  singapore: 'SG', sg: 'SG',
  canada: 'CA', ca: 'CA',
  australia: 'AU', au: 'AU',
  germany: 'DE', de: 'DE',
  netherlands: 'NL', nl: 'NL',
  ireland: 'IE', france: 'FR', spain: 'ES', poland: 'PL',
  uae: 'AE', 'united arab emirates': 'AE', japan: 'JP', switzerland: 'CH',
};

const INDIAN_CITY_TO_STATE: Record<string, string> = {
  bengaluru: 'Karnataka', bangalore: 'Karnataka', mysuru: 'Karnataka',
  mumbai: 'Maharashtra', pune: 'Maharashtra', nagpur: 'Maharashtra',
  delhi: 'Delhi', 'new delhi': 'Delhi', noida: 'Uttar Pradesh', ghaziabad: 'Uttar Pradesh',
  gurugram: 'Haryana', gurgaon: 'Haryana', faridabad: 'Haryana',
  hyderabad: 'Telangana', chennai: 'Tamil Nadu', coimbatore: 'Tamil Nadu',
  kochi: 'Kerala', cochin: 'Kerala', thiruvananthapuram: 'Kerala', kozhikode: 'Kerala',
  kolkata: 'West Bengal', ahmedabad: 'Gujarat', surat: 'Gujarat', jaipur: 'Rajasthan',
  indore: 'Madhya Pradesh', bhopal: 'Madhya Pradesh', chandigarh: 'Chandigarh',
  dehradun: 'Uttarakhand', lucknow: 'Uttar Pradesh', bhubaneswar: 'Odisha',
};

const REMOTE_RE = /\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b|\bvirtual\b|\bdistributed\b/i;
const HYBRID_RE = /\bhybrid\b|\bflexible\b|\bpartially remote\b/i;

export function normalizeCountry(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = collapseWhitespace(input).toLowerCase();
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key] as string;
  if (/^[a-z]{2}$/i.test(key)) return key.toUpperCase();
  return null;
}

export function detectWorkMode(...sources: Array<string | null | undefined>): WorkMode {
  const text = sources.filter(Boolean).join(' ');
  if (HYBRID_RE.test(text)) return 'hybrid';
  if (REMOTE_RE.test(text)) return 'remote';
  return 'onsite';
}

/**
 * Parses free-form location strings: "Bengaluru, Karnataka, India",
 * "Remote - India", "San Francisco, CA", "London, UK".
 */
export function parseLocation(raw: string | null | undefined): LocationSpec {
  const base: LocationSpec = { city: null, state: null, country: null, raw: raw ?? null };
  if (!raw) return base;

  const cleaned = collapseWhitespace(raw)
    .replace(/^(remote|hybrid|onsite|on-site)\s*[-–—:,|]\s*/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();

  if (!cleaned || REMOTE_RE.test(cleaned) && !/,/.test(cleaned)) {
    return { ...base, country: normalizeCountry(cleaned) };
  }

  const parts = cleaned.split(/\s*[,|/]\s*/).filter(Boolean);
  let country: string | null = null;
  let state: string | null = null;
  let city: string | null = null;

  if (parts.length > 0) {
    const last = parts[parts.length - 1] as string;
    country = normalizeCountry(last);
    if (country) parts.pop();
  }
  if (parts.length >= 2) {
    state = parts[parts.length - 1] as string;
    city = parts[0] as string;
  } else if (parts.length === 1) {
    city = parts[0] as string;
  }

  if (city && !state) {
    const mapped = INDIAN_CITY_TO_STATE[city.toLowerCase()];
    if (mapped) {
      state = mapped;
      country = country ?? 'IN';
    }
  }
  if (city && !country && INDIAN_CITY_TO_STATE[city.toLowerCase()]) country = 'IN';

  return { city, state, country, raw };
}
