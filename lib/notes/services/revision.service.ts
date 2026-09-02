/**
 * lib/notes/services/revision.service.ts
 *
 * Builds a RevisionPlan from already-generated notes content. Deliberately
 * pure logic — no AI call needed, since importance/difficulty are already
 * in the NotesOutput the generator produced. Uses a simple spaced-repetition
 * curve (1, 3, 7, 14, 30 days) weighted by topic importance and the note's
 * overall difficulty, which is enough for "when should I revisit this" without
 * needing a full SRS algorithm (SM-2/FSRS) for a first version.
 *
 * Takes the persisted `Notes` (for id/title) alongside the in-flight
 * `NoteGenerationOutput` (for per-topic importance) — call this right after
 * generateAndSaveNotes() with its `notes` and `output` fields, since the
 * structured topic breakdown doesn't survive persistence (only markdown does).
 */

import type { Notes, NoteGenerationOutput, NotesOutput, RevisionPlan } from "../models/types";

const BASE_INTERVALS_DAYS = [1, 3, 7, 14, 30];

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "topics" in content;
}

/**
 * High-importance topics get revisited on every interval; medium on every
 * other interval; low only at the two longest intervals (just enough to not
 * forget it entirely, without cluttering the schedule).
 */
function shouldReviewOnInterval(
  importance: "low" | "medium" | "high" | undefined,
  intervalIndex: number
): boolean {
  if (importance === "high") return true;
  if (importance === "medium") return intervalIndex % 2 === 0;
  return intervalIndex >= BASE_INTERVALS_DAYS.length - 2;
}

export function buildRevisionPlan(
  notes: Notes,
  content: NoteGenerationOutput,
  startDate: Date = new Date()
): RevisionPlan {
  const schedule: RevisionPlan["schedule"] = [];

  if (!isProseNotes(content)) {
    // Mind maps / flashcards don't carry per-topic importance — schedule the
    // whole set on the standard interval curve instead of per-topic.
    for (const days of BASE_INTERVALS_DAYS) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + days);
      schedule.push({ date: date.toISOString().slice(0, 10), topics: [notes.title] });
    }
    return { id: notes.id, notesId: notes.id, schedule };
  }

  const topics = content.topics;

  BASE_INTERVALS_DAYS.forEach((days, intervalIndex) => {
    const topicsForThisInterval = topics
      .filter((t) => shouldReviewOnInterval(t.importance, intervalIndex))
      .map((t) => t.title);

    if (topicsForThisInterval.length === 0) return;

    const date = new Date(startDate);
    date.setDate(date.getDate() + days);
    schedule.push({ date: date.toISOString().slice(0, 10), topics: topicsForThisInterval });
  });

  return { id: notes.id, notesId: notes.id, schedule };
}

/** Total distinct study sessions a full revision plan implies — useful for a "X sessions to master this" UI hint. */
export function countPlannedSessions(plan: RevisionPlan): number {
  return plan.schedule.length;
}
