import type { EmploymentType, WorkMode } from './internship.types';

export type SortKey =
  | 'relevance'
  | 'recent'
  | 'deadline'
  | 'stipend_desc'
  | 'stipend_asc'
  | 'match_score';

export interface InternshipFilters {
  country?: string;
  state?: string;
  city?: string;
  company?: string[];
  role?: string;
  workMode?: WorkMode[];
  employmentType?: EmploymentType[];
  paid?: boolean;
  minStipendInr?: number;
  maxStipendInr?: number;
  skills?: string[];
  cgpa?: number;
  year?: number;
  degree?: string;
  branch?: string;
  minDurationMonths?: number;
  maxDurationMonths?: number;
  providers?: string[];
  postedAfter?: string;
  deadlineBefore?: string;
  activeOnly?: boolean;
}

export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export interface SearchRequest {
  q?: string;
  mode?: SearchMode;
  filters?: InternshipFilters;
  sort?: SortKey;
  limit?: number;
  cursor?: string | null;
  userId?: string | null;
}

export interface SearchHit<T> {
  item: T;
  score: number;
  matchedOn: string[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number | null;
  tookMs: number;
}
