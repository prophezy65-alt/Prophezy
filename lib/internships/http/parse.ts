import type { EmploymentType, InternshipFilters, SearchRequest, SortKey, SearchMode, WorkMode } from '../types';
import { bool, list, num, oneOf, str } from '../utils/validation';
import { MAX_PAGE_SIZE } from '../config/constants';

const SORTS: readonly SortKey[] = [
  'relevance', 'recent', 'deadline', 'stipend_desc', 'stipend_asc', 'match_score',
];
const MODES: readonly SearchMode[] = ['keyword', 'semantic', 'hybrid'];
const WORK_MODES: readonly WorkMode[] = ['remote', 'hybrid', 'onsite'];
const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  'internship', 'apprenticeship', 'co_op', 'trainee', 'fellowship',
  'part_time', 'full_time', 'contract', 'volunteer',
];

export function parseSearchRequest(url: URL, userId: string | null): SearchRequest {
  const get = (key: string): string | null => url.searchParams.get(key);

  const filters: InternshipFilters = {
    country: get('country') ?? undefined,
    state: get('state') ?? undefined,
    city: get('city') ?? undefined,
    company: get('company') ? list(str({ max: 96 }))(get('company'), 'company') : undefined,
    role: get('role') ?? undefined,
    workMode: get('workMode')
      ? (list(oneOf(WORK_MODES, false))(get('workMode'), 'workMode').filter(Boolean) as WorkMode[])
      : undefined,
    // This was the entire bug: the query string always had employmentType
    // in it (confirmed — api.ts sends it correctly), but this function
    // never read it, so it was silently dropped before ever reaching the
    // database filter. Discover/Recommended-style filtering by category
    // (Internships vs Jobs) had no effect no matter what the client sent,
    // because the server-side filters object simply never had the key.
    employmentType: get('employmentType')
      ? (list(oneOf(EMPLOYMENT_TYPES, false))(get('employmentType'), 'employmentType').filter(
          Boolean,
        ) as EmploymentType[])
      : undefined,
    paid: bool()(get('paid'), 'paid') ?? undefined,
    minStipendInr: num({ min: 0, optional: true })(get('minStipend'), 'minStipend') ?? undefined,
    maxStipendInr: num({ min: 0, optional: true })(get('maxStipend'), 'maxStipend') ?? undefined,
    skills: get('skills') ? list(str({ max: 60 }))(get('skills'), 'skills') : undefined,
    cgpa: num({ min: 0, max: 10, optional: true })(get('cgpa'), 'cgpa') ?? undefined,
    year: num({ min: 2000, max: 2100, optional: true })(get('year'), 'year') ?? undefined,
    degree: get('degree') ?? undefined,
    branch: get('branch') ?? undefined,
    minDurationMonths: num({ min: 0, max: 60, optional: true })(get('minDuration'), 'minDuration') ?? undefined,
    maxDurationMonths: num({ min: 0, max: 60, optional: true })(get('maxDuration'), 'maxDuration') ?? undefined,
    providers: get('providers') ? list(str({ max: 40 }))(get('providers'), 'providers') : undefined,
    postedAfter: get('postedAfter') ?? undefined,
    deadlineBefore: get('deadlineBefore') ?? undefined,
    activeOnly: bool()(get('activeOnly'), 'activeOnly') ?? true,
  };

  return {
    q: get('q') ? str({ max: 300 })(get('q'), 'q') : undefined,
    mode: oneOf(MODES)(get('mode'), 'mode') ?? undefined,
    sort: oneOf(SORTS)(get('sort'), 'sort') ?? 'relevance',
    limit: Math.min(Number(get('limit') ?? 20) || 20, MAX_PAGE_SIZE),
    cursor: get('cursor'),
    filters,
    userId,
  };
}
