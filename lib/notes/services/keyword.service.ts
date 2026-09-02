/**
 * lib/notes/services/keyword.service.ts
 *
 * Keyword extraction and duplicate-topic detection over generated notes.
 * Both are cheap non-AI operations (frequency counting, string similarity)
 * deliberately kept out of Gemini calls — there's no need to spend an AI
 * request extracting keywords when the definitions/topics/formulas arrays
 * already generated are the keyword source of truth.
 *
 * Both functions take the in-flight `NoteGenerationOutput` (tagged with a
 * notesId/title where a caller needs to attribute results back to a saved
 * note) rather than persisted `Notes` objects, since this structured data
 * only exists at generation time — the real schema stores only markdown.
 */

import type { NoteGenerationOutput, NotesOutput } from "../models/types";

function isProseNotes(content: NoteGenerationOutput): content is NotesOutput {
  return "topics" in content;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "in", "on", "for", "and", "or", "is", "are",
  "was", "were", "be", "been", "this", "that", "these", "those", "with",
  "as", "by", "at", "from", "it", "its", "into", "than", "then", "which",
]);

/** Extracts ranked keywords from a generation's title/overview/definitions/topics text, by frequency. */
export function extractKeywords(content: NoteGenerationOutput, limit = 20): { term: string; count: number }[] {
  if (!isProseNotes(content)) return [];

  const text: string[] = [content.title, content.overview];
  for (const topic of content.topics) {
    text.push(topic.title, topic.summary);
    for (const sub of topic.subtopics ?? []) text.push(sub.title, sub.summary);
  }
  for (const def of content.definitions) text.push(def.term);

  const counts = new Map<string, number>();
  for (const chunk of text) {
    const words = chunk
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Jaccard similarity between two strings' word sets — cheap, dependency-free near-duplicate signal. */
function wordSetSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = new Set([...setA].filter((w) => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export interface DuplicateTopicMatch {
  notesIdA: string;
  topicA: string;
  notesIdB: string;
  topicB: string;
  similarity: number;
}

/**
 * Flags topics across a user's notes that look like duplicates (same
 * concept generated twice from different sources), above `threshold`
 * similarity, so the UI can suggest merging rather than showing the same
 * material twice.
 */
export function detectDuplicateTopics(
  notesList: { notesId: string; content: NoteGenerationOutput }[],
  threshold = 0.6
): DuplicateTopicMatch[] {
  const matches: DuplicateTopicMatch[] = [];
  const proseNotesList = notesList.filter(
    (n): n is { notesId: string; content: NotesOutput } => isProseNotes(n.content)
  );

  for (let i = 0; i < proseNotesList.length; i++) {
    for (let j = i + 1; j < proseNotesList.length; j++) {
      const a = proseNotesList[i]!;
      const b = proseNotesList[j]!;

      for (const topicA of a.content.topics) {
        for (const topicB of b.content.topics) {
          const similarity = wordSetSimilarity(topicA.title, topicB.title);
          if (similarity >= threshold) {
            matches.push({
              notesIdA: a.notesId,
              topicA: topicA.title,
              notesIdB: b.notesId,
              topicB: topicB.title,
              similarity,
            });
          }
        }
      }
    }
  }

  return matches.sort((x, y) => y.similarity - x.similarity);
}
