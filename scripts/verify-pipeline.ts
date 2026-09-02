/**
 * Dependency-free verification of the deterministic pipeline.
 * Touches no network, no database, no AI — safe to run in CI on every push.
 *
 *   npx tsx scripts/verify-pipeline.ts
 *
 * Exits non-zero on any failure.
 */
import { parseCompensation, toMonthlyInr } from '../lib/internships/utils/money';
import { detectWorkMode, parseLocation } from '../lib/internships/utils/location';
import { extractSkills } from '../lib/internships/utils/skills';
import { parseDurationMonths } from '../lib/internships/utils/date';
import { titleTokenSimilarity, trigramSimilarity, normalizeTitle } from '../lib/internships/utils/text';
import { DUPLICATE_TITLE_THRESHOLD, DUPLICATE_TOKEN_THRESHOLD } from '../lib/internships/config/constants';
import { buildPosting, looksLikeInternship } from '../lib/internships/providers/base/posting.builder';
import { DeduplicationService } from '../lib/internships/services/deduplication.service';
import { NormalizerService } from '../lib/internships/services/normalizer.service';
import { RankingService } from '../lib/internships/services/ranking.service';
import { parseRss } from '../lib/internships/providers/aggregators/weworkremotely.provider';

let failures = 0;

function check(label: string, actual: unknown, expected?: unknown): void {
  const pass = expected === undefined
    ? Boolean(actual)
    : JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label} => ${JSON.stringify(actual)}`);
}

function section(name: string): void {
  console.log(`\n--- ${name} ---`);
}

section('compensation parsing');
check('INR monthly with separator', toMonthlyInr(parseCompensation('₹25,000 per month')), 25_000);
check('INR lakh per annum', toMonthlyInr(parseCompensation('Rs 2.5 lakh per annum')), 20_833);
check('USD hourly', toMonthlyInr(parseCompensation('$30 per hour')), 412_800);
check('unpaid detected', parseCompensation('This is an unpaid internship').isUnpaid, true);
check('undisclosed stays null', parseCompensation('Competitive').min, null);

section('location and work mode');
check('full Indian location', parseLocation('Bengaluru, Karnataka, India'), {
  city: 'Bengaluru', state: 'Karnataka', country: 'IN', raw: 'Bengaluru, Karnataka, India',
});
check('state inferred from city', parseLocation('Kochi').state, 'Kerala');
check('UK resolved', parseLocation('London, UK').country, 'GB');
check('hybrid from title', detectWorkMode('Data Intern (Hybrid)', 'Pune'), 'hybrid');
check('remote from location', detectWorkMode('SWE Intern', 'Work from home'), 'remote');

section('skills and duration');
check('skills extracted', extractSkills(
  'React & Node.js intern',
  'You will use TypeScript, PostgreSQL and Docker. Machine learning a plus.',
));
check('months parsed', parseDurationMonths('6 months'), 6);
check('week range parsed', parseDurationMonths('8-12 weeks'), 2.3);

section('internship filter');
check('accepts intern role', looksLikeInternship('Software Engineering Intern'), true);
check('rejects senior role', looksLikeInternship('Senior Engineer, Intern Program'), false);

section('title matching');
const titlePairs: Array<[string, string, boolean]> = [
  ['Software Engineering Intern', 'Software Engineer Intern', true],
  ['Data Science Intern', 'Data Scientist Intern', true],
  ['Marketing Intern', 'Marketing Internship', true],
  ['Backend Developer Intern', 'Backend Development Intern', true],
  ['Data Science Intern', 'Data Engineering Intern', false],
  ['Backend Engineer Intern', 'Frontend Engineer Intern', false],
  ['Marketing Intern', 'Finance Intern', false],
  ['Product Design Intern', 'Product Management Intern', false],
  ['ML Research Intern', 'ML Engineering Intern', false],
];
for (const [left, right, shouldMerge] of titlePairs) {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  const merged =
    trigramSimilarity(a, b) >= DUPLICATE_TITLE_THRESHOLD ||
    titleTokenSimilarity(a, b) >= DUPLICATE_TOKEN_THRESHOLD;
  check(`${shouldMerge ? 'merge' : 'keep '} "${left}" / "${right}"`, merged, shouldMerge);
}

section('normalize -> dedupe -> rank');
const posting = (provider: string, title: string, description: string) => buildPosting({
  provider,
  externalId: `${provider}-1`,
  title,
  companyName: 'Acme Labs',
  locationRaw: 'Bengaluru, India',
  descriptionText: description,
  applyUrl: `https://${provider}.test/job/1`,
  postedAt: new Date().toISOString(),
});

const normalizer = new NormalizerService();
const normalized = [
  posting('greenhouse', 'Software Engineering Intern',
    'Build with React and TypeScript. Open to B.Tech CSE students graduating in 2027. '
    + 'Minimum CGPA 7.5. Duration: 6 months. Stipend 40000 per month.'),
  posting('adzuna', 'Software Engineer Intern', 'Work on React/TypeScript products.'),
].map((item) => normalizer.enrichDeterministic(item));

const first = normalized[0];
if (!first) throw new Error('normalization produced no output');

check('degree parsed', first.eligibility.degrees, ['B.Tech']);
check('branch parsed', first.eligibility.branches, ['Computer Science']);
check('CGPA parsed', first.eligibility.minCgpa, 7.5);
check('graduation year parsed', first.eligibility.years, [2027]);
check('duration parsed', first.duration.months, 6);

const { merged, duplicatesRemoved } = new DeduplicationService().dedupe(normalized);
const survivor = merged[0];
if (!survivor) throw new Error('deduplication produced no output');

check('cross-provider duplicate merged', merged.length, 1);
check('duplicate counted', duplicatesRemoved, 1);
check('both apply links retained', survivor.sources.map((s) => s.provider), ['greenhouse', 'adzuna']);

const ranking = new RankingService();
const quality = ranking.qualityScore(survivor);
check('quality score bounded', quality > 0 && quality <= 1, true);
check('heuristic match scores', ranking.heuristicMatch(survivor, {
  userId: 'verify', degree: 'B.Tech', branch: 'Computer Science', graduationYear: 2027, cgpa: 8.2,
  skills: ['React', 'TypeScript', 'Node.js'], preferredRoles: ['software'],
  preferredLocations: ['Bengaluru'], preferredWorkModes: ['onsite'], minStipendInr: 20_000,
  resumeText: null, resumeEmbedding: null,
}) > 0, true);

section('rss parsing');
check('RSS item parsed', parseRss(
  '<rss><channel><item><title><![CDATA[Acme: Marketing Intern]]></title>'
  + '<link>https://x.test/1</link><description>Intern role</description>'
  + '<pubDate>Tue, 21 Jul 2026 10:00:00 +0000</pubDate><region>Remote</region></item></channel></rss>',
).length, 1);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
if (failures > 0) process.exit(1);
