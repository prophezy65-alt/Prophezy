/**
 * lib/syllabus/services/study-planner.service.ts
 *
 * The Study Planner is deterministic scheduling math over a
 * previously generated SmartRoadmap — it does NOT call the AI
 * engine. Re-running an AI prompt every time a student ticks off a
 * topic or misses a day would be slow, expensive, and non-
 * deterministic for something that's fundamentally arithmetic:
 * remaining days, hours required, and redistribution of weak/strong
 * topic time. (Notes/quiz/flashcards/etc. still go through the AI
 * engine — this is the one feature in the spec that's genuinely a
 * computation, not a generation task.)
 */

import { validateStudyPlannerInput } from '../validation/syllabus.validation';
import type {
  AdaptiveStudyPlan,
  RoadmapDayPlan,
  SmartRoadmap,
  StudyPlannerInput,
} from '../models/syllabus.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(examDate: string): number {
  const diff = Date.parse(examDate) - Date.now();
  return Math.max(1, Math.ceil(diff / MS_PER_DAY));
}

export function buildAdaptiveStudyPlan(
  roadmap: SmartRoadmap,
  rawInput: Partial<StudyPlannerInput>,
): AdaptiveStudyPlan {
  const input = validateStudyPlannerInput(rawInput);

  const completed = new Set(input.completedTopics);
  const weak = new Set(input.weakTopics);
  const strong = new Set(input.strongTopics);

  const remainingDays = daysUntil(input.examDate);

  const remainingTopics = roadmap.prioritizedTopics.filter(
    (t) => !completed.has(t.topic),
  );

  const totalHoursRequired = remainingTopics.reduce(
    (sum, t) => sum + t.estimatedHours,
    0,
  );

  // Weak topics get a 1.4x time multiplier, strong topics a 0.7x
  // multiplier, redistributing the same total pool of hours rather
  // than inflating the plan — this is what "weak/strong allocation"
  // means in practice: the same remaining-hours budget, spent
  // unevenly based on the student's own self-assessment.
  const weighted = remainingTopics.map((t) => {
    const multiplier = weak.has(t.topic) ? 1.4 : strong.has(t.topic) ? 0.7 : 1.0;
    return { topic: t.topic, weightedHours: t.estimatedHours * multiplier };
  });
  const weightedTotal = weighted.reduce((sum, w) => sum + w.weightedHours, 0);
  const scale = weightedTotal > 0 ? totalHoursRequired / weightedTotal : 1;

  const weakTopicAllocation = weighted
    .filter((w) => weak.has(w.topic))
    .map((w) => ({
      topic: w.topic,
      hoursAllocated: Math.round(w.weightedHours * scale * 10) / 10,
    }));

  const strongTopicAllocation = weighted
    .filter((w) => strong.has(w.topic))
    .map((w) => ({
      topic: w.topic,
      hoursAllocated: Math.round(w.weightedHours * scale * 10) / 10,
    }));

  const hoursPerDay = input.hoursAvailablePerDay;

  // Missed-day recovery: pull the topics that were originally
  // scheduled on missed days and redistribute them across the
  // remaining days, proportionally, rather than silently dropping
  // them.
  const missedDays = input.missedDays ?? [];
  const redistributedTopics = roadmap.dailyPlan
    .filter((d) => missedDays.includes(d.dayIndex))
    .flatMap((d) => d.topics)
    .filter((topic) => !completed.has(topic));

  const activeDailyPlan: RoadmapDayPlan[] = roadmap.dailyPlan
    .filter((d) => !missedDays.includes(d.dayIndex) && d.dayIndex < remainingDays)
    .map((d) => ({ ...d, topics: [...d.topics] }));

  const dayLoad = new Map(activeDailyPlan.map((d) => [d.dayIndex, d.estimatedHours]));
  redistributedTopics.forEach((topic, i) => {
    const targetDay = activeDailyPlan[i % activeDailyPlan.length];
    if (targetDay) {
      targetDay.topics.push(topic);
      targetDay.estimatedHours = (dayLoad.get(targetDay.dayIndex) ?? 0) + 1;
      dayLoad.set(targetDay.dayIndex, targetDay.estimatedHours);
    }
  });

  return {
    syllabusId: roadmap.syllabusId,
    generatedAt: new Date().toISOString(),
    remainingDays,
    totalHoursRequired: Math.round(totalHoursRequired * 10) / 10,
    hoursPerDay,
    weakTopicAllocation,
    strongTopicAllocation,
    recoveryPlan: {
      missedDays,
      redistributedTopics,
      note:
        redistributedTopics.length > 0
          ? `${redistributedTopics.length} topic(s) from ${missedDays.length} missed day(s) were redistributed across the remaining schedule.`
          : 'No missed days to recover.',
    },
    dailyPlan: activeDailyPlan,
  };
}

export { daysUntil as _daysUntil }; // exported for unit tests only
