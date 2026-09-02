import type {
  ProviderCapabilities,
  ProviderDescriptor,
  ProviderRateLimit,
} from '../types';

const NO_CAPS: ProviderCapabilities = {
  incrementalSync: false,
  keywordQuery: false,
  locationQuery: false,
  remoteFilter: false,
  pagination: false,
  providesSalary: false,
  providesDeadline: false,
};

const FULL_CAPS: ProviderCapabilities = {
  incrementalSync: true,
  keywordQuery: true,
  locationQuery: true,
  remoteFilter: true,
  pagination: true,
  providesSalary: true,
  providesDeadline: false,
};

const GENTLE: ProviderRateLimit = { requestsPerMinute: 30, concurrency: 2, minDelayMs: 400 };
const STANDARD: ProviderRateLimit = { requestsPerMinute: 60, concurrency: 4, minDelayMs: 200 };

function caps(overrides: Partial<ProviderCapabilities>): ProviderCapabilities {
  return { ...NO_CAPS, ...overrides };
}

/**
 * Why some entries are `unsupported`:
 * these sources publish no public/partner API for third-party job aggregation, and their
 * terms prohibit automated extraction. They are still registered so the sync scheduler,
 * health dashboard and admin UI treat them as first-class rows. Supplying a partner
 * credential and swapping the implementation class is the only change required.
 */
const UNSUPPORTED_NOTE =
  'No public or partner API available for third-party aggregation. Registered as a stub; ' +
  'requires a commercial data agreement or official API access before it can be enabled.';

function partnerStub(
  key: string,
  label: string,
  homepage: string,
  region: ProviderDescriptor['region'],
  kind: ProviderDescriptor['kind'] = 'partner',
): ProviderDescriptor {
  return {
    key,
    label,
    kind,
    region,
    homepage,
    status: 'unsupported',
    capabilities: NO_CAPS,
    rateLimit: GENTLE,
    requiredEnv: [],
    integrationNote: UNSUPPORTED_NOTE,
  };
}

/** Providers with a real, implemented integration. */
export const IMPLEMENTED_PROVIDERS: ProviderDescriptor[] = [
  {
    key: 'greenhouse',
    label: 'Greenhouse Job Boards',
    kind: 'ats',
    region: 'global',
    homepage: 'https://developers.greenhouse.io/job-board.html',
    status: 'active',
    capabilities: caps({ pagination: false, providesDeadline: false }),
    rateLimit: STANDARD,
    requiredEnv: ['GREENHOUSE_BOARD_TOKENS'],
    integrationNote:
      'Public Job Board API. Set GREENHOUSE_BOARD_TOKENS to a comma-separated list of board tokens ' +
      '(e.g. "stripe,anthropic"). Covers most company career pages hosted on Greenhouse.',
  },
  {
    key: 'lever',
    label: 'Lever Postings',
    kind: 'ats',
    region: 'global',
    homepage: 'https://github.com/lever/postings-api',
    status: 'active',
    capabilities: caps({ providesDeadline: false }),
    rateLimit: STANDARD,
    requiredEnv: ['LEVER_SITES'],
    integrationNote: 'Public Postings API. Set LEVER_SITES to a comma-separated list of company slugs.',
  },
  {
    key: 'ashby',
    label: 'Ashby Job Board',
    kind: 'ats',
    region: 'global',
    homepage: 'https://developers.ashbyhq.com',
    status: 'active',
    capabilities: caps({ providesSalary: true }),
    rateLimit: STANDARD,
    requiredEnv: ['ASHBY_BOARDS'],
    integrationNote: 'Public job board endpoint. Set ASHBY_BOARDS to a comma-separated list of board names.',
  },
  {
    key: 'adzuna',
    label: 'Adzuna',
    kind: 'aggregator',
    region: 'global',
    homepage: 'https://developer.adzuna.com',
    status: 'active',
    capabilities: FULL_CAPS,
    rateLimit: GENTLE,
    requiredEnv: ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'],
    integrationNote: 'Official REST API. Free tier available. Covers IN, GB, US and 15+ other countries.',
  },
  {
    key: 'jooble',
    label: 'Jooble',
    kind: 'aggregator',
    region: 'global',
    homepage: 'https://jooble.org/api/about',
    status: 'active',
    capabilities: caps({ keywordQuery: true, locationQuery: true, pagination: true, providesSalary: true }),
    rateLimit: GENTLE,
    requiredEnv: ['JOOBLE_API_KEY'],
    integrationNote: 'Official partner API. Request a key from Jooble; POST-based search.',
  },
  {
    key: 'themuse',
    label: 'The Muse',
    kind: 'aggregator',
    region: 'international',
    homepage: 'https://www.themuse.com/developers/api/v2',
    status: 'active',
    capabilities: caps({ keywordQuery: false, locationQuery: true, pagination: true }),
    rateLimit: GENTLE,
    requiredEnv: [],
    integrationNote: 'Public API v2. Optional THEMUSE_API_KEY raises the rate limit.',
  },
  {
    key: 'remotive',
    label: 'Remotive',
    kind: 'board',
    region: 'global',
    homepage: 'https://remotive.com/api/remote-jobs',
    status: 'active',
    capabilities: caps({ keywordQuery: true, remoteFilter: true, providesSalary: true }),
    rateLimit: GENTLE,
    requiredEnv: [],
    integrationNote: 'Public JSON feed, remote roles only.',
  },
  {
    key: 'remoteok',
    label: 'Remote OK',
    kind: 'board',
    region: 'global',
    homepage: 'https://remoteok.com/api',
    status: 'active',
    capabilities: caps({ remoteFilter: true, providesSalary: true }),
    rateLimit: GENTLE,
    requiredEnv: [],
    integrationNote: 'Public JSON feed. Attribution back-link required by their terms.',
  },
  {
    key: 'weworkremotely',
    label: 'We Work Remotely',
    kind: 'board',
    region: 'global',
    homepage: 'https://weworkremotely.com/remote-jobs.rss',
    status: 'active',
    capabilities: caps({ remoteFilter: true }),
    rateLimit: GENTLE,
    requiredEnv: [],
    integrationNote: 'Public RSS feed.',
  },
  {
    key: 'arbeitnow',
    label: 'Arbeitnow',
    kind: 'board',
    region: 'international',
    homepage: 'https://www.arbeitnow.com/api/job-board-api',
    status: 'active',
    capabilities: caps({ pagination: true, remoteFilter: true }),
    rateLimit: GENTLE,
    requiredEnv: [],
    integrationNote: 'Public job board API, EU-heavy, includes visa-sponsorship flags.',
  },
];

/** Registered but not yet integrable — see UNSUPPORTED_NOTE. */
export const STUB_PROVIDERS: ProviderDescriptor[] = [
  // India
  partnerStub('internshala', 'Internshala', 'https://internshala.com', 'india'),
  partnerStub('linkedin', 'LinkedIn Jobs', 'https://www.linkedin.com/jobs', 'global'),
  partnerStub('naukri', 'Naukri', 'https://www.naukri.com', 'india'),
  partnerStub('indeed_in', 'Indeed India', 'https://in.indeed.com', 'india'),
  partnerStub('unstop', 'Unstop', 'https://unstop.com', 'india'),
  partnerStub('hellointern', 'HelloIntern', 'https://www.hellointern.com', 'india'),
  partnerStub('letsintern', 'LetsIntern', 'https://www.letsintern.com', 'india'),
  partnerStub('freshersworld', 'Freshersworld', 'https://www.freshersworld.com', 'india'),
  partnerStub('youth4work', 'Youth4Work', 'https://www.youth4work.com', 'india'),
  partnerStub('cutshort', 'Cutshort', 'https://cutshort.io', 'india'),
  partnerStub('wellfound', 'Wellfound', 'https://wellfound.com', 'global'),
  partnerStub('foundit', 'Foundit', 'https://www.foundit.in', 'india'),
  partnerStub('apna', 'Apna', 'https://apna.co', 'india'),
  partnerStub('shine', 'Shine', 'https://www.shine.com', 'india'),
  partnerStub('hirist', 'Hirist', 'https://www.hirist.tech', 'india'),
  partnerStub('hackerearth', 'HackerEarth Jobs', 'https://www.hackerearth.com/jobs', 'india'),
  partnerStub('hackerrank', 'HackerRank Jobs', 'https://www.hackerrank.com', 'global'),
  partnerStub('aicte', 'AICTE Internship Portal', 'https://internship.aicte-india.org', 'india', 'portal'),
  partnerStub('mospi', 'MoSPI Internship', 'https://www.mospi.gov.in', 'india', 'portal'),
  partnerStub('drdo', 'DRDO Careers', 'https://www.drdo.gov.in', 'india', 'portal'),
  partnerStub('isro', 'ISRO Careers', 'https://www.isro.gov.in/Careers.html', 'india', 'portal'),
  partnerStub('bhel', 'BHEL Careers', 'https://careers.bhel.in', 'india', 'portal'),
  partnerStub('bel', 'BEL Careers', 'https://bel-india.in/careers', 'india', 'portal'),
  partnerStub('npcil', 'NPCIL Careers', 'https://npcil.nic.in', 'india', 'portal'),
  // International
  partnerStub('indeed', 'Indeed', 'https://www.indeed.com', 'international'),
  partnerStub('glassdoor', 'Glassdoor', 'https://www.glassdoor.com', 'international'),
  partnerStub('handshake', 'Handshake', 'https://joinhandshake.com', 'international'),
  partnerStub('ziprecruiter', 'ZipRecruiter', 'https://www.ziprecruiter.com', 'international'),
  partnerStub('simplyhired', 'SimplyHired', 'https://www.simplyhired.com', 'international'),
  partnerStub('careerbuilder', 'CareerBuilder', 'https://www.careerbuilder.com', 'international'),
  partnerStub('flexjobs', 'FlexJobs', 'https://www.flexjobs.com', 'international'),
  partnerStub('ripplematch', 'RippleMatch', 'https://ripplematch.com', 'international'),
  partnerStub('levelsfyi', 'Levels.fyi', 'https://www.levels.fyi/jobs', 'international'),
  partnerStub('ycombinator', 'Y Combinator Jobs', 'https://www.workatastartup.com', 'international'),
  partnerStub('otta', 'Otta', 'https://otta.com', 'international'),
  partnerStub('gradconnection', 'GradConnection', 'https://www.gradconnection.com', 'international'),
  partnerStub('prosple', 'Prosple', 'https://prosple.com', 'international'),
  partnerStub('extern', 'Extern', 'https://www.extern.com', 'international'),
  partnerStub('parkerdewey', 'Parker Dewey', 'https://www.parkerdewey.com', 'international'),
  partnerStub('forage', 'Forage', 'https://www.theforage.com', 'international'),
];

/**
 * Large employers whose careers sites run on an ATS we already support.
 * These are configured as ATS board tokens rather than separate providers —
 * that is the "adding a provider requires almost zero changes" property in practice.
 */
export const KNOWN_ATS_BOARDS: Record<'greenhouse' | 'lever' | 'ashby', string[]> = {
  greenhouse: ['stripe', 'databricks', 'figma', 'anthropic', 'discord'],
  lever: ['netflix', 'palantir'],
  ashby: ['openai', 'ramp', 'linear'],
};

export const ALL_DESCRIPTORS: ProviderDescriptor[] = [
  ...IMPLEMENTED_PROVIDERS,
  ...STUB_PROVIDERS,
];

export function getDescriptor(key: string): ProviderDescriptor | null {
  return ALL_DESCRIPTORS.find((d) => d.key === key) ?? null;
}
