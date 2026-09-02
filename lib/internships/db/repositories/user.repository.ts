import { getServiceClient } from '../client';
import { EngineError } from '../../utils/errors';
import type { NotificationRecord, UserProfileSnapshot } from '../../types';
import { rowToNotification, type NotificationRow } from '../mappers';
import { dedupeSkills } from '../../utils/skills';

interface ProfileRow {
  id: string;
  degree: string | null;
  branch: string | null;
  graduation_year: number | null;
  cgpa: number | null;
  skills: string[] | null;
  preferred_roles: string[] | null;
  preferred_locations: string[] | null;
  preferred_work_modes: string[] | null;
  min_stipend_inr: number | null;
  resume_text: string | null;
  resume_embedding: number[] | string | null;
}

export interface NotificationPreferences {
  userId: string;
  dailyDigest: boolean;
  weeklyDigest: boolean;
  newInternshipAlerts: boolean;
  deadlineReminders: boolean;
  matchAlerts: boolean;
  followedCompanies: string[];
  followedRoles: string[];
  minMatchScore: number;
  channels: NotificationRecord['channel'][];
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId'> = {
  dailyDigest: true,
  weeklyDigest: true,
  newInternshipAlerts: true,
  deadlineReminders: true,
  matchAlerts: true,
  followedCompanies: [],
  followedRoles: [],
  minMatchScore: 70,
  channels: ['in_app'],
};

export class UserRepository {
  private get db() {
    return getServiceClient();
  }

  /**
   * Reads from the existing `profiles` table. Resume text is sourced from the
   * Resume Studio module's latest active resume when present.
   */
  async getProfile(userId: string): Promise<UserProfileSnapshot> {
    const { data, error } = await this.db
      .from('internship_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);

    const row = (data ?? null) as ProfileRow | null;
    return {
      userId,
      degree: row?.degree ?? null,
      branch: row?.branch ?? null,
      graduationYear: row?.graduation_year ?? null,
      cgpa: row?.cgpa ?? null,
      skills: dedupeSkills(row?.skills ?? []),
      preferredRoles: row?.preferred_roles ?? [],
      preferredLocations: row?.preferred_locations ?? [],
      preferredWorkModes: row?.preferred_work_modes ?? [],
      minStipendInr: row?.min_stipend_inr ?? null,
      resumeText: row?.resume_text ?? null,
      resumeEmbedding: parseVector(row?.resume_embedding ?? null),
    };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const { data, error } = await this.db
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    if (!data) return { userId, ...DEFAULT_PREFERENCES };

    const row = data as Record<string, unknown>;
    return {
      userId,
      dailyDigest: Boolean(row.daily_digest ?? true),
      weeklyDigest: Boolean(row.weekly_digest ?? true),
      newInternshipAlerts: Boolean(row.new_internship_alerts ?? true),
      deadlineReminders: Boolean(row.deadline_reminders ?? true),
      matchAlerts: Boolean(row.match_alerts ?? true),
      followedCompanies: (row.followed_companies as string[]) ?? [],
      followedRoles: (row.followed_roles as string[]) ?? [],
      minMatchScore: Number(row.min_match_score ?? 70),
      channels: ((row.channels as string[]) ?? ['in_app']) as NotificationRecord['channel'][],
    };
  }

  async listActiveUserIds(limit = 5_000): Promise<string[]> {
    const { data, error } = await this.db
      .from('internship_profiles')
      .select('id')
      .limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as Array<{ id: string }>).map((r) => r.id);
  }

  async insertNotifications(
    entries: ReadonlyArray<Omit<NotificationRecord, 'id' | 'createdAt' | 'readAt'>>,
  ): Promise<number> {
    if (entries.length === 0) return 0;
    const { error, count } = await this.db.from('notifications').insert(
      entries.map((entry) => ({
        user_id: entry.userId,
        kind: entry.kind,
        channel: entry.channel,
        payload: entry.payload,
        sent_at: entry.sentAt,
      })),
      { count: 'exact' },
    );
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
    return count ?? entries.length;
  }

  async listNotifications(userId: string, unreadOnly: boolean, limit: number): Promise<NotificationRecord[]> {
    let query = this.db.from('notifications').select('*').eq('user_id', userId);
    if (unreadOnly) query = query.is('read_at', null);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
    if (error) throw new EngineError('DB_READ_FAILED', error.message);
    return (data as NotificationRow[]).map(rowToNotification);
  }

  async markNotificationsRead(userId: string, ids: readonly string[]): Promise<void> {
    let query = this.db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId);
    if (ids.length > 0) query = query.in('id', ids as string[]);
    const { error } = await query;
    if (error) throw new EngineError('DB_WRITE_FAILED', error.message);
  }
}

function parseVector(value: number[] | string | null): number[] | null {
  if (value === null) return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}
