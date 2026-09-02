/**
 * lib/quiz/utils/timer.ts
 *
 * Pure time calculations for timed exam modes. The actual countdown lives
 * client-side; the backend only needs to validate that a submission landed
 * within the allotted window (with a small grace period for network lag)
 * and to compute elapsed time for analytics.
 */

const SUBMISSION_GRACE_SEC = 10;

export interface TimeWindowCheck {
  withinLimit: boolean;
  elapsedSec: number;
  overageSec: number;
}

export function checkTimeWindow(startedAt: string, submittedAt: string, timeLimitSec: number | null): TimeWindowCheck {
  const elapsedSec = Math.round((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000);

  if (timeLimitSec === null) {
    return { withinLimit: true, elapsedSec, overageSec: 0 };
  }

  const limitWithGrace = timeLimitSec + SUBMISSION_GRACE_SEC;
  const overageSec = Math.max(0, elapsedSec - timeLimitSec);

  return { withinLimit: elapsedSec <= limitWithGrace, elapsedSec, overageSec };
}

/** Seconds remaining right now, for a client polling the server as a fallback to its own local countdown. */
export function secondsRemaining(startedAt: string, timeLimitSec: number | null): number | null {
  if (timeLimitSec === null) return null;
  const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, timeLimitSec - elapsed);
}
