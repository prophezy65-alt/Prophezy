/**
 * lib/notes/services/analytics.service.ts
 *
 * Study analytics derived from StudySession history + generated notes
 * content. No AI call — this is aggregation logic over data the app already
 * has (sessions logged as a student studies, notes already generated).
 */

import type { NoteGenerationOutput, NotesOutput, StudySession } from "../models/types";

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "topics" in content;
}

export interface WeakTopic {
  notesId: string;
  topic: string;
  timesStudied: number;
  /** Higher = more neglected relative to its declared importance. */
  neglectScore: number;
}

/**
 * A topic is "weak" if it's high/medium importance but has been covered in
 * few or no study sessions relative to other topics in the same note set —
 * a simple, explainable proxy for "you should revisit this" without needing
 * quiz/test-score data this module doesn't have access to.
 *
 * Takes `notesId` + the in-flight `NoteGenerationOutput` separately (rather
 * than a persisted `Notes` object) since the real schema stores only
 * markdown after generation — this structured topic breakdown only exists
 * at generation time, before formatter.service.ts flattens it.
 */
export function detectWeakTopics(
  notesId: string,
  content: NoteGenerationOutput,
  sessions: StudySession[]
): WeakTopic[] {
  if (!isProseNotes(content)) return [];

  const sessionsForNotes = sessions.filter((s) => s.notesId === notesId);
  const coverageCount = new Map<string, number>();

  for (const session of sessionsForNotes) {
    for (const topic of session.topicsCovered) {
      coverageCount.set(topic, (coverageCount.get(topic) ?? 0) + 1);
    }
  }

  const importanceWeight = { high: 3, medium: 2, low: 1 } as const;

  return content.topics
    .map((topic) => {
      const timesStudied = coverageCount.get(topic.title) ?? 0;
      const weight = importanceWeight[topic.importance ?? "medium"];
      const neglectScore = weight / (timesStudied + 1);
      return { notesId, topic: topic.title, timesStudied, neglectScore };
    })
    .sort((a, b) => b.neglectScore - a.neglectScore);
}

export interface ProgressSuggestion {
  message: string;
  priority: "low" | "medium" | "high";
}

/** Turns weak-topic + session data into a short list of plain-language next steps. */
export function suggestNextSteps(
  notesId: string,
  content: NoteGenerationOutput,
  sessions: StudySession[],
  limit = 3
): ProgressSuggestion[] {
  const weak = detectWeakTopics(notesId, content, sessions).filter((t) => t.timesStudied === 0);
  const suggestions: ProgressSuggestion[] = [];

  for (const topic of weak.slice(0, limit)) {
    suggestions.push({
      message: `You haven't studied "${topic.topic}" yet — it's worth a first pass.`,
      priority: topic.neglectScore >= 3 ? "high" : "medium",
    });
  }

  const sessionsForNotes = sessions.filter((s) => s.notesId === notesId);
  if (sessionsForNotes.length === 0) {
    suggestions.unshift({
      message: "Start your first study session on these notes.",
      priority: "high",
    });
  }

  return suggestions.slice(0, limit);
}

/** Simple aggregate: total sessions, total distinct topics covered, days since last session. */
export function summarizeProgress(notesId: string, sessions: StudySession[]) {
  const sessionsForNotes = sessions.filter((s) => s.notesId === notesId);
  const topicsCovered = new Set(sessionsForNotes.flatMap((s) => s.topicsCovered));
  const lastSession = sessionsForNotes
    .map((s) => s.startedAt)
    .sort()
    .at(-1);

  const daysSinceLastSession = lastSession
    ? Math.floor((Date.now() - new Date(lastSession).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    totalSessions: sessionsForNotes.length,
    distinctTopicsCovered: topicsCovered.size,
    daysSinceLastSession,
  };
}
