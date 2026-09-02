import { StudySessionsRepository } from "../db/study-sessions.repository";
import type { StudyAnalytics, StudySession } from "../types";

const MS_PER_DAY = 86_400_000;

/** UTC calendar date as YYYY-MM-DD. Streaks are computed on UTC days —
 *  a genuine per-user-timezone streak would need the user's timezone
 *  stored somewhere, which nothing in the schema currently captures. */
function toUtcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Pure function, no I/O — given the set of calendar dates that had at
 *  least one completed study session, returns current + longest streak.
 *  Exported so it can be unit tested directly. */
export function computeStreaks(dateKeys: readonly string[], todayKey: string): { current: number; longest: number } {
  const uniqueSorted = Array.from(new Set(dateKeys)).sort().reverse(); // newest first
  if (uniqueSorted.length === 0) return { current: 0, longest: 0 };

  const dateSet = new Set(uniqueSorted);

  // Current streak: walk backward from today (or yesterday, if nothing
  // logged yet today) while consecutive days are present.
  let current = 0;
  const cursor = new Date(`${todayKey}T00:00:00Z`);
  if (!dateSet.has(todayKey)) {
    // No session today — streak isn't broken until a day is fully missed,
    // so check yesterday as the starting point instead.
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // Longest streak: scan all dates for the longest consecutive run.
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  const ascending = [...uniqueSorted].reverse(); // oldest first
  for (const key of ascending) {
    const d = new Date(`${key}T00:00:00Z`);
    if (prev && d.getTime() - prev.getTime() === MS_PER_DAY) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest };
}

export class StudySessionsService {
  private readonly repo = new StudySessionsRepository();

  async startSession(userId: string, subject: string | null): Promise<StudySession> {
    return this.repo.start(userId, subject);
  }

  async endSession(userId: string, sessionId: string, notes: string | null): Promise<StudySession> {
    return this.repo.end(userId, sessionId, notes);
  }

  async getActiveSession(userId: string): Promise<StudySession | null> {
    const active = await this.repo.listActive(userId);
    if (active.length === 0) return null;
    if (active.length > 1) {
      // Shouldn't happen in normal use (the UI only ever starts one at a
      // time), but if it does, surface the most recent rather than silently
      // picking an arbitrary one.
      return active[0] ?? null;
    }
    return active[0] ?? null;
  }

  async getAnalytics(userId: string): Promise<StudyAnalytics> {
    const sessions = await this.repo.listCompleted(userId, 120);

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);

    let totalSecondsAllTime = 0;
    let totalSecondsThisWeek = 0;
    const byDate = new Map<string, number>();

    for (const s of sessions) {
      const seconds = s.durationSeconds ?? 0;
      totalSecondsAllTime += seconds;

      const startedAt = new Date(s.startedAt);
      if (startedAt >= weekAgo) totalSecondsThisWeek += seconds;

      const key = toUtcDateKey(s.startedAt);
      byDate.set(key, (byDate.get(key) ?? 0) + seconds);
    }

    const { current, longest } = computeStreaks(Array.from(byDate.keys()), todayKey);

    const dailyBreakdown = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * MS_PER_DAY);
      const key = d.toISOString().slice(0, 10);
      return { date: key, seconds: byDate.get(key) ?? 0 };
    });

    return {
      totalSessions: sessions.length,
      totalSecondsThisWeek,
      totalSecondsAllTime,
      currentStreakDays: current,
      longestStreakDays: longest,
      dailyBreakdown,
    };
  }
}
