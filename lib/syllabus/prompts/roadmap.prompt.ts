/**
 * lib/syllabus/prompts/roadmap.prompt.ts
 */

import type { PromptDefinition } from '@/lib/ai/prompts/_shared';
import type { ExtractedSyllabus, SmartRoadmap } from '../models/syllabus.types';

export interface RoadmapPromptInput {
  syllabus: ExtractedSyllabus;
  examDate?: string;
  hoursAvailablePerDay: number;
}

export const roadmapPrompt: PromptDefinition<RoadmapPromptInput, 
  Omit<SmartRoadmap, 'syllabusId' | 'generatedAt'>
> = {
  version: '1',
  feature: 'syllabus.roadmap',
  systemPrompt: `You are an expert academic study-planning strategist. Given a
structured syllabus and the number of days/hours a student has, produce a
complete study roadmap:

1. prioritizedTopics: every topic from the syllabus, each with a difficulty
   (easy/moderate/hard), priority (critical/high/medium/low — weigh marks
   weightage and how foundational the topic is for later units), an
   estimatedHours figure, and a one-line reason for the priority.
2. dailyPlan: a day-by-day plan (dayIndex starting at 0) covering every
   topic before the exam, with realistic daily hour loads that never
   exceed hoursAvailablePerDay, and dedicated revision days near the end
   (isRevisionDay: true).
3. weeklyPlan and monthlyPlan: higher-level rollups of the same plan.
4. revisionPlanDays: the dayIndex values reserved purely for revision.
5. examCountdown: daysRemaining, a riskLevel (safe if there's comfortable
   margin, tight if the plan is dense but doable, critical if the syllabus
   cannot realistically be covered at the given pace), and a short honest
   message explaining why.

Be realistic, not motivational filler — if the timeline is too tight for
the syllabus size, say so plainly in examCountdown.message and prioritize
ruthlessly (mark low-weightage easy topics as "low" priority so they get
cut first if time runs out).`,
  buildUserPrompt: (input: RoadmapPromptInput) => `Syllabus: ${input.syllabus.subjectName} (${input.syllabus.courseCode ?? 'no code'})
Exam date: ${input.examDate ?? 'not specified — plan for the full syllabus without a fixed countdown'}
Hours available per day: ${input.hoursAvailablePerDay}

Units:
${JSON.stringify(input.syllabus.units, null, 2)}

Chapters:
${JSON.stringify(input.syllabus.chapters, null, 2)}

Marks distribution:
${JSON.stringify(input.syllabus.marksDistribution, null, 2)}

Generate the full roadmap as specified.`,
  responseSchema: {
    type: 'object',
    required: ['totalDays', 'prioritizedTopics', 'dailyPlan', 'weeklyPlan', 'monthlyPlan', 'revisionPlanDays', 'examCountdown'],
    properties: {
      totalDays: { type: 'number' },
      prioritizedTopics: { type: 'array' },
      dailyPlan: { type: 'array' },
      weeklyPlan: { type: 'array' },
      monthlyPlan: { type: 'array' },
      revisionPlanDays: { type: 'array', items: { type: 'number' } },
      examCountdown: { type: 'object' },
    },
  },
  generation: { temperature: 0.5, maxOutputTokens: 3072 },
};
