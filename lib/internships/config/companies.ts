import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.config.companies');

export type AtsProviderKey = 'greenhouse' | 'lever' | 'ashby' | 'workable';

export interface CompanyConfigEntry {
  name: string;
  provider: AtsProviderKey;
  url: string;
}

interface CompaniesFile {
  companies: CompanyConfigEntry[];
}

/**
 * User-editable, zero-code company registry.
 * Add an entry to `companies.json` — e.g. { "name": "Google", "provider": "greenhouse",
 * "url": "https://boards.greenhouse.io/google" } — and the next sync run picks it up.
 * No deploy-time code change or env var edit required.
 */
const COMPANIES_FILE = join(__dirname, 'companies.json');

let cached: CompanyConfigEntry[] | null = null;

function loadCompanies(): CompanyConfigEntry[] {
  if (cached) return cached;
  try {
    const raw = readFileSync(COMPANIES_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as CompaniesFile;
    cached = Array.isArray(parsed.companies) ? parsed.companies : [];
  } catch (error) {
    log.warn('companies.json missing or invalid — continuing with env-configured boards only', {
      error: (error as Error).message,
    });
    cached = [];
  }
  return cached;
}

/** Extracts the board token Greenhouse/Lever/Ashby expect from a public job-board URL. */
function extractToken(provider: AtsProviderKey, url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    const segment = path.split('/')[0];
    return segment ? segment.trim() : null;
  } catch {
    log.warn('unparseable company url in companies.json', { provider, url });
    return null;
  }
}

/** Board tokens declared in companies.json for one ATS provider, deduplicated. */
export function getConfiguredBoards(provider: AtsProviderKey): string[] {
  const tokens = loadCompanies()
    .filter((c) => c.provider === provider)
    .map((c) => extractToken(provider, c.url))
    .filter((t): t is string => Boolean(t));
  return [...new Set(tokens)];
}
