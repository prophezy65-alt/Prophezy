/**
 * lib/quiz/services/leaderboard.service.ts
 *
 * Updates leaderboard entries after a graded attempt and reads rankings.
 * Scopes are plain strings so new ones (e.g. per-exam-mode) can be added
 * without a schema change — see 0025_quiz_analytics_leaderboard.sql.
 */

import type { LeaderboardEntry, QuizAttempt } from "../models/quiz.types";
import * as provider from "../providers/supabase-quiz.provider";

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Points awarded for a graded attempt, factoring accuracy and difficulty. */
function computeLeaderboardPoints(attempt: QuizAttempt, difficultyMultiplier: number): number {
  if (attempt.finalScore === null || attempt.maxScore === 0) return 0;
  const accuracyFraction = attempt.finalScore / attempt.maxScore;
  return Math.round(accuracyFraction * 100 * difficultyMultiplier);
}

const DIFFICULTY_MULTIPLIER: Record<string, number> = { easy: 0.8, medium: 1, hard: 1.3, expert: 1.6 };

export async function recordAttemptOnLeaderboard(
  attempt: QuizAttempt,
  userId: string,
  difficulty: string,
  subject: string | null
): Promise<void> {
  const points = computeLeaderboardPoints(attempt, DIFFICULTY_MULTIPLIER[difficulty] ?? 1);
  if (points <= 0) return;

  const updates: Array<[string, string | null]> = [["global", null]];
  if (subject) updates.push([`subject:${subject}`, subject]);
  updates.push([`weekly:${isoWeek(new Date())}`, null]);

  await Promise.all(updates.map(([scope, subj]) => provider.upsertLeaderboardEntry(userId, scope, subj, points)));
}

export async function getGlobalLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  return provider.getLeaderboard("global", limit);
}

export async function getSubjectLeaderboard(subject: string, limit = 50): Promise<LeaderboardEntry[]> {
  return provider.getLeaderboard(`subject:${subject}`, limit);
}

export async function getWeeklyLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  return provider.getLeaderboard(`weekly:${isoWeek(new Date())}`, limit);
}

// ---- streaks + badges ----------------------------------------------------

export interface StreakUpdate {
  currentStreak: number;
  longestStreak: number;
  newBadges: string[];
}

const STREAK_BADGE_MILESTONES = [3, 7, 14, 30, 100];

/** Pure function: given yesterday's streak state and whether the user was active today, computes the new state. Persistence is the caller's job. */
export function computeStreakUpdate(
  previous: { currentStreak: number; longestStreak: number; lastActivityDate: string | null },
  activityDate: string // YYYY-MM-DD
): StreakUpdate {
  const prevDate = previous.lastActivityDate;
  let currentStreak: number;

  if (prevDate === activityDate) {
    currentStreak = previous.currentStreak; // already counted today
  } else if (prevDate === yesterday(activityDate)) {
    currentStreak = previous.currentStreak + 1;
  } else {
    currentStreak = 1; // streak broken or first-ever activity
  }

  const longestStreak = Math.max(previous.longestStreak, currentStreak);
  const newBadges = STREAK_BADGE_MILESTONES.filter((m) => currentStreak === m).map((m) => `streak_${m}`);

  return { currentStreak, longestStreak, newBadges };
}

function yesterday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Reads today's streak state, computes the update, and persists it plus any newly-earned streak badges. Call once per graded attempt. */
export async function recordDailyActivity(userId: string): Promise<StreakUpdate> {
  const today = new Date().toISOString().slice(0, 10);
  const previous = await provider.getStreak(userId);
  const update = computeStreakUpdate(previous, today);

  await provider.upsertStreak(userId, {
    currentStreak: update.currentStreak,
    longestStreak: update.longestStreak,
    lastActivityDate: today,
  });

  if (update.newBadges.length > 0) {
    await provider.insertBadgesIfNew(userId, update.newBadges);
  }

  return update;
}
