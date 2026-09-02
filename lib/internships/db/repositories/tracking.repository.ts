import { getServiceClient } from '../client';
import { rowToApplication, type ApplicationRow } from '../mappers';
import type { ApplicationRecord, ApplicationStatus } from '../../types';
import { EngineError, NotFoundError } from '../../utils/errors';

export interface SavedRow {
  id: string;
  user_id: string;
  internship_id: string;
  created_at: string;
}

export class TrackingRepository {
  private get db() {
    return getServiceClient();
  }

  async save(userId: string, internshipId: string): Promise<void> {
    const { error } = await this.db
      .from('saved_internships')
      .upsert({ user_id: userId, internship_id: internshipId }, { onConflict: 'user_id,internship_id' });
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }

  async unsave(userId: string, internshipId: string): Promise<void> {
    const { error } = await this.db
      .from('saved_internships')
      .delete()
      .eq('user_id', userId)
      .eq('internship_id', internshipId);
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }

  async listSavedIds(userId: string, limit = 200): Promise<string[]> {
    const { data, error } = await this.db
      .from('saved_internships')
      .select('internship_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as Array<{ internship_id: string }>).map((r) => r.internship_id);
  }

  async recordView(userId: string, internshipId: string): Promise<void> {
    const { error } = await this.db
      .from('internship_views')
      .upsert(
        { user_id: userId, internship_id: internshipId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,internship_id' },
      );
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }

  async listRecentlyViewedIds(userId: string, limit = 50): Promise<string[]> {
    const { data, error } = await this.db
      .from('internship_views')
      .select('internship_id')
      .eq('user_id', userId)
      .order('viewed_at', { ascending: false })
      .limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as Array<{ internship_id: string }>).map((r) => r.internship_id);
  }

  async upsertApplication(input: {
    userId: string;
    internshipId: string;
    status: ApplicationStatus;
    appliedAt?: string | null;
    interviewAt?: string | null;
    decisionAt?: string | null;
    deadlineAt?: string | null;
    notes?: string | null;
    documents?: ApplicationRecord['documents'];
  }): Promise<ApplicationRecord> {
    const { data, error } = await this.db
      .from('applications')
      .upsert(
        {
          user_id: input.userId,
          internship_id: input.internshipId,
          status: input.status,
          applied_at: input.appliedAt ?? null,
          interview_at: input.interviewAt ?? null,
          decision_at: input.decisionAt ?? null,
          deadline_at: input.deadlineAt ?? null,
          notes: input.notes ?? null,
          documents: input.documents ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,internship_id' },
      )
      .select('*')
      .single();

    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
    return rowToApplication(data as ApplicationRow);
  }

  async findApplication(userId: string, internshipId: string): Promise<ApplicationRecord | null> {
    const { data, error } = await this.db
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .eq('internship_id', internshipId)
      .maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return data ? rowToApplication(data as ApplicationRow) : null;
  }

  async listApplications(userId: string, status?: ApplicationStatus): Promise<ApplicationRecord[]> {
    let query = this.db.from('applications').select('*').eq('user_id', userId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(500);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as ApplicationRow[]).map(rowToApplication);
  }

  async requireApplication(userId: string, internshipId: string): Promise<ApplicationRecord> {
    const found = await this.findApplication(userId, internshipId);
    if (!found) throw new NotFoundError('Application', `${userId}:${internshipId}`);
    return found;
  }

  /** Applications with a deadline inside the window and no terminal status yet. */
  async findUpcomingDeadlines(withinDays: number): Promise<ApplicationRecord[]> {
    const now = new Date();
    const until = new Date(now.getTime() + withinDays * 86_400_000).toISOString();
    const { data, error } = await this.db
      .from('applications')
      .select('*')
      .gte('deadline_at', now.toISOString())
      .lte('deadline_at', until)
      .in('status', ['saved', 'applied', 'interview_scheduled'])
      .limit(2_000);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as ApplicationRow[]).map(rowToApplication);
  }
}
