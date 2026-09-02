/**
 * lib/syllabus/services/progress-tracker.service.ts
 *
 * Progress/mastery is a deterministic scoring function over data the
 * student/app already has (completion flags, revision counts, self-
 * rated confidence, quiz accuracy) — there is nothing here for an
 * LLM to "generate", so this does not call the AI engine. Keeping a
 * pure function also makes exam-readiness scoring reproducible and
 * cheap to recompute on every dashboard load.
 */

import { validateTopicProgressInputs } from '../validation/syllabus.validation';
import type { ProgressSnapshot, TopicProgressInput } from '../models/syllabus.types';

// Weights for the composite mastery score. Revision count is capped at
// 5 for scoring purposes — more than 5 revisions doesn't keep adding
// value in this model.
const WEIGHTS = {
  completed: 0.3,
  revision: 0.25,
  confidence: 0.2,
  quizAccuracy: 0.25,
};
const REVISION_CAP = 5;

function scoreTopic(input: TopicProgressInput): number {
  const completedScore = input.completed ? 100 : 0;
  const revisionScore = Math.min(input.revisedCount, REVISION_CAP) * (100 / REVISION_CAP);
  const confidenceScore = input.selfRatedConfidence ?? (input.completed ? 60 : 0);
  const quizScore = input.quizAccuracyPercent ?? confidenceScore;

  return Math.round(
    completedScore * WEIGHTS.completed +
      revisionScore * WEIGHTS.revision +
      confidenceScore * WEIGHTS.confidence +
      quizScore * WEIGHTS.quizAccuracy,
  );
}

function readinessBand(score: number): ProgressSnapshot['estimatedExamReadiness']['band'] {
  if (score >= 85) return 'exam_ready';
  if (score >= 65) return 'on_track';
  if (score >= 40) return 'needs_work';
  return 'not_ready';
}

export function computeProgressSnapshot(
  syllabusId: string,
  rawInputs: Partial<TopicProgressInput>[],
): ProgressSnapshot {
  const inputs = validateTopicProgressInputs(rawInputs);
  const total = inputs.length || 1;

  const perTopic = inputs.map((input) => ({ ...input, masteryScore: scoreTopic(input) }));

  const completionPercent = Math.round(
    (inputs.filter((i) => i.completed).length / total) * 100,
  );
  const revisionPercent = Math.round(
    (inputs.reduce((sum, i) => sum + Math.min(i.revisedCount, REVISION_CAP), 0) /
      (total * REVISION_CAP)) *
      100,
  );
  const confidencePercent = Math.round(
    inputs.reduce((sum, i) => sum + (i.selfRatedConfidence ?? 0), 0) / total,
  );
  const masteryPercent = Math.round(
    perTopic.reduce((sum, t) => sum + t.masteryScore, 0) / total,
  );

  return {
    syllabusId,
    computedAt: new Date().toISOString(),
    completionPercent,
    revisionPercent,
    confidencePercent,
    masteryPercent,
    estimatedExamReadiness: {
      score: masteryPercent,
      band: readinessBand(masteryPercent),
    },
    perTopic,
  };
}
