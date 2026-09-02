import { getServiceClient } from '../client';
import { internshipToRow, rowToInternship, type InternshipRow } from '../mappers';
import type { InternshipFilters, InternshipRecord, NormalizedInternship, SortKey } from '../../types';
import { EngineError, NotFoundError } from '../../utils/errors';
import { MAX_PAGE_SIZE } from '../../config/constants';
import { createLogger } from '../../utils/logger';

const log = createLogger('internships.repo');

export interface ListParams {
  filters: InternshipFilters;
  sort: SortKey;
  limit: number;
  offset: number;
  /** free-text applied via the generated tsvector column */
  q?: string | null;
}

export class InternshipRepository {
  private get db() {
    return getServiceClient();
  }

  async upsertMany(items: readonly NormalizedInternship[], qualityScores: readonly number[]): Promise<number> {
    if (items.length === 0) {
      log.info('upsertMany called with 0 items — nothing to persist', {});
      return 0;
    }

    const rows = items.map((item, index) => internshipToRow(item, qualityScores[index] ?? 0.5));

    // --- DIAGNOSTIC LOGGING (temporary — remove once persistence is confirmed healthy) ---
    console.log('Rows before insert:', rows.length);
    console.log('Sample row before insert:', JSON.stringify(rows[0], null, 2));
    const missingFingerprint = rows.filter((r) => !r.fingerprint).length;
    const missingApplyUrl = rows.filter((r) => !r.apply_url || !r.apply_url.startsWith('http')).length;
    const nullCompanySlug = rows.filter((r) => !r.company_slug).length;
    if (missingFingerprint || missingApplyUrl || nullCompanySlug) {
      console.warn('Row shape warnings:', { missingFingerprint, missingApplyUrl, nullCompanySlug });
    }
    log.info('upsertMany invoked', {
      rowCount: rows.length,
      sampleFingerprint: rows[0]?.fingerprint,
      sampleCompanySlug: rows[0]?.company_slug,
    });
    // company_id is intentionally NOT set here — internshipToRow() never populates it
    // (there is no company-resolution step in this codebase). If the `internships`
    // table has `company_id` as NOT NULL or as a foreign key without a default, every
    // row in this batch will fail together. That will surface below as a Postgres
    // error with code 23502 (not-null violation) or 23503 (foreign key violation).

    const { data, error, count, status, statusText } = await this.db
      .from('internships')
      .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: false, count: 'exact' })
      .select('id');

    console.log('Supabase insert result:', { status, statusText, count, returnedRows: data?.length ?? null });

    if (error) {
      // Do NOT swallow this. Print everything Postgres told us, then re-throw.
      console.error('Supabase error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      log.error('internships upsert failed', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        rowCount: rows.length,
      });

      // Common root causes, surfaced explicitly so they show up in CI/Action logs
      // without needing to cross-reference Postgres error codes by hand.
      if (error.code === '42P10') {
        log.error(
          'ON CONFLICT target "fingerprint" has no matching unique or exclusion constraint — ' +
            'add `create unique index if not exists internships_fingerprint_key on internships(fingerprint);`',
          {},
        );
      } else if (error.code === '23502') {
        log.error(
          'Not-null constraint violation — a required column (check company_id) has no value ' +
            'in the payload. Either make the column nullable or populate it before upserting.',
          {},
        );
      } else if (error.code === '23503') {
        log.error(
          'Foreign key violation — a referenced row (e.g. in `companies`) does not exist. ' +
            'internshipToRow() does not currently resolve/create a companies row.',
          {},
        );
      }

      throw new EngineError('DB_UPSERT_FAILED', error.message, 500, {
        table: 'internships',
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    const rowsActuallyInserted = count ?? data?.length ?? 0;
    console.log('Rows actually inserted:', rowsActuallyInserted);
    log.info('internships upsert succeeded', { rowsActuallyInserted, rowsSent: rows.length });

    if (rowsActuallyInserted === 0 && rows.length > 0) {
      log.warn(
        'upsert reported success but 0 rows were affected — check RLS policies on the ' +
          'service-role connection and confirm SUPABASE_SERVICE_ROLE_KEY (not the anon key) is set',
        {},
      );
    }
    // --- END DIAGNOSTIC LOGGING ---

    return rowsActuallyInserted;
  }

  async findById(id: string): Promise<InternshipRecord> {
    const { data, error } = await this.db.from('internships').select('*').eq('id', id).maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    if (!data) throw new NotFoundError('Internship', id);
    return rowToInternship(data as InternshipRow);
  }

  async findByIds(ids: readonly string[]): Promise<InternshipRecord[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from('internships').select('*').in('id', ids as string[]);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as InternshipRow[]).map(rowToInternship);
  }

  async findByFingerprints(fingerprints: readonly string[]): Promise<InternshipRecord[]> {
    if (fingerprints.length === 0) return [];
    const { data, error } = await this.db
      .from('internships')
      .select('*')
      .in('fingerprint', fingerprints as string[]);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as InternshipRow[]).map(rowToInternship);
  }

  /**
   * NOTE: every branch below ends with `.order('id', { ascending: true })`.
   * Without it, Postgres has no guaranteed stable order for rows that tie on
   * the primary sort column (posted_at, quality_score, stipend_monthly_inr
   * all repeat across many rows), and `.range()` (OFFSET/LIMIT) pagination
   * against an unstable order can return the same row on two different
   * pages — or skip one — especially with the sync worker inserting/updating
   * rows concurrently. The `id` tiebreaker makes this a true total order.
   */
  async list(params: ListParams): Promise<{ items: InternshipRecord[]; total: number | null }> {
    // No { count: 'exact' } here on purpose: an exact count forces Postgres
    // to fully count every matching row on every single search request —
    // the single most expensive part of this query — and nothing in the
    // product actually reads Page.total (search is infinite-scroll, driven
    // by nextCursor/hasNextPage, not a "X of Y results" display; verified
    // no frontend consumer reads it). `total: null` here is honest about
    // that, matches the existing `number | null` contract (SearchService
    // already returns null in the semantic-only path), and removes a real
    // per-request Postgres cost from the hottest read path in the app.
    let query = this.db.from('internships').select('*');
    query = applyFilters(query, params.filters);

    if (params.q) {
      query = query.textSearch('search_vector', toTsQuery(params.q), { type: 'plain', config: 'english' });
    }

    switch (params.sort) {
      case 'recent':
        query = query
          .order('posted_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true });
        break;
      case 'deadline':
        query = query
          .order('deadline_at', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true });
        break;
      case 'stipend_desc':
        query = query
          .order('stipend_monthly_inr', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true });
        break;
      case 'stipend_asc':
        query = query
          .order('stipend_monthly_inr', { ascending: true, nullsFirst: false })
          .order('id', { ascending: true });
        break;
      default:
        query = query
          .order('quality_score', { ascending: false })
          .order('posted_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true });
    }

    const limit = Math.min(params.limit, MAX_PAGE_SIZE);
    query = query.range(params.offset, params.offset + limit - 1);

    const { data, error } = await query;
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return { items: (data as InternshipRow[]).map(rowToInternship), total: null };
  }

  /** Vector search via the `match_internships` SQL function (pgvector). */
  async semanticSearch(
    embedding: readonly number[],
    limit: number,
    filters: InternshipFilters,
  ): Promise<Array<{ item: InternshipRecord; similarity: number }>> {
    const { data, error } = await this.db.rpc('match_internships', {
      query_embedding: embedding as number[],
      match_count: Math.min(limit, MAX_PAGE_SIZE),
      filter_country: filters.country ?? null,
      filter_work_modes: filters.workMode ?? null,
      filter_min_stipend: filters.minStipendInr ?? null,
      filter_active_only: filters.activeOnly ?? true,
    });
    if (error) throw new EngineError('DB_RPC_FAILED', error.message, 500, { fn: 'match_internships' });

    return (data as Array<InternshipRow & { similarity: number }>).map((row) => ({
      item: rowToInternship(row),
      similarity: row.similarity,
    }));
  }

  async setEmbeddings(entries: ReadonlyArray<{ id: string; embedding: number[] }>): Promise<void> {
    if (entries.length === 0) return;
    for (const entry of entries) {
      const { error } = await this.db
        .from('internships')
        .update({ embedding: entry.embedding })
        .eq('id', entry.id);
      if (error) throw new EngineError('DB_UPDATE_FAILED', error.message);
    }
  }

  async findMissingEmbeddings(limit: number): Promise<InternshipRecord[]> {
    const { data, error } = await this.db
      .from('internships')
      .select('*')
      .is('embedding', null)
      .eq('is_active', true)
      .limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as InternshipRow[]).map(rowToInternship);
  }

  async incrementCounter(id: string, column: 'view_count' | 'apply_count'): Promise<void> {
    const { error } = await this.db.rpc('increment_internship_counter', {
      internship_id: id,
      counter: column,
    });
    if (error) throw new EngineError('DB_RPC_FAILED', error.message);
  }

  /** Marks expired postings inactive. Returns how many were closed. */
  async deactivateExpired(): Promise<number> {
    const { data, error } = await this.db
      .from('internships')
      .update({ is_active: false })
      .lt('deadline_at', new Date().toISOString())
      .eq('is_active', true)
      .select('id');
    if (error) throw new EngineError('DB_UPDATE_FAILED', error.message);
    return (data ?? []).length;
  }

  /** Postings not seen in any sync for `days` are treated as filled. */
  async deactivateStale(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await this.db
      .from('internships')
      .update({ is_active: false })
      .lt('updated_at', cutoff)
      .eq('is_active', true)
      .select('id');
    if (error) throw new EngineError('DB_UPDATE_FAILED', error.message);
    return (data ?? []).length;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyFilters(query: any, filters: InternshipFilters): any {
  let q = query;
  if (filters.activeOnly !== false) q = q.eq('is_active', true);
  if (filters.country) q = q.eq('country', filters.country.toUpperCase());
  if (filters.state) q = q.ilike('state', filters.state);
  if (filters.city) q = q.ilike('city', filters.city);
  if (filters.company?.length) q = q.in('company_slug', filters.company);
  if (filters.role) q = q.ilike('title', `%${filters.role}%`);
  if (filters.workMode?.length) q = q.in('work_mode', filters.workMode);
  if (filters.employmentType?.length) q = q.in('employment_type', filters.employmentType);
  if (filters.paid === true) q = q.eq('is_unpaid', false).not('stipend_monthly_inr', 'is', null);
  if (filters.paid === false) q = q.eq('is_unpaid', true);
  if (filters.minStipendInr !== undefined) q = q.gte('stipend_monthly_inr', filters.minStipendInr);
  if (filters.maxStipendInr !== undefined) q = q.lte('stipend_monthly_inr', filters.maxStipendInr);
  if (filters.skills?.length) q = q.overlaps('skills', filters.skills);
  if (filters.cgpa !== undefined) q = q.or(`min_cgpa.is.null,min_cgpa.lte.${filters.cgpa}`);
  if (filters.year !== undefined) q = q.or(`eligible_years.is.null,eligible_years.cs.{${filters.year}}`);
  if (filters.degree) q = q.or(`degrees.is.null,degrees.cs.{"${filters.degree}"}`);
  if (filters.branch) q = q.or(`branches.is.null,branches.cs.{"${filters.branch}"}`);
  if (filters.minDurationMonths !== undefined) q = q.gte('duration_months', filters.minDurationMonths);
  if (filters.maxDurationMonths !== undefined) q = q.lte('duration_months', filters.maxDurationMonths);
  if (filters.postedAfter) q = q.gte('posted_at', filters.postedAfter);
  if (filters.deadlineBefore) q = q.lte('deadline_at', filters.deadlineBefore);
  return q;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Escapes user input before it reaches to_tsquery. */
function toTsQuery(input: string): string {
  return input.replace(/[&|!():*'"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
