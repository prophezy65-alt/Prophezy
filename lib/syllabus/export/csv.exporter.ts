/**
 * lib/syllabus/export/csv.exporter.ts
 *
 * CSV only makes sense for resource kinds with a natural tabular
 * shape (quiz questions, flashcards, marks distribution, PYQ
 * mapping, analytics). For narrative kinds (notes, revision packs)
 * we still emit a valid single-column CSV of lines rather than
 * silently failing — a caller who explicitly asked for CSV export
 * gets a CSV, just a less interesting one.
 */

import type { ExportableResource } from '../models/syllabus.types';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return lines.join('\n');
}

export function renderResourceToCsv(resource: ExportableResource): string {
  switch (resource.kind) {
    case 'quiz':
      return toCsv(
        ['Type', 'Question', 'Options', 'Correct Answer', 'Marks', 'Difficulty', 'Topic'],
        resource.data.questions.map((q) => [
          q.type,
          q.question,
          (q.options ?? []).join(' | '),
          q.correctAnswer,
          q.marks,
          q.difficulty,
          q.topic,
        ]),
      );

    case 'flashcards':
      return toCsv(
        ['Front', 'Back', 'Difficulty', 'Due Date'],
        resource.data.cards.map((c) => [c.front, c.back, c.difficulty, c.srs.dueDate]),
      );

    case 'syllabus':
      return toCsv(
        ['Component', 'Marks', 'Weightage %'],
        resource.data.marksDistribution.map((m) => [m.component, m.marks, m.weightagePercent ?? '']),
      );

    case 'pyq_map':
      return toCsv(
        ['Syllabus Topic', 'Coverage Status', 'Matched Questions', 'Notes'],
        resource.data.entries.map((e) => [
          e.syllabusTopic,
          e.coverageStatus,
          e.matchedQuestions.join(' | '),
          e.notes,
        ]),
      );

    case 'paper_prediction':
      return toCsv(
        ['Topic', 'Probability %', 'Predicted Marks', 'Reason'],
        resource.data.mostImportantTopics.map((t) => [
          t.topic,
          t.probabilityScore,
          t.predictedMarks,
          t.reason,
        ]),
      );

    case 'analytics':
      return toCsv(
        ['Chapter/Unit', 'Hardness', 'Length', 'Importance', 'Scoring Potential', 'Frequency Asked'],
        resource.data.entries.map((e) => [
          e.chapterOrUnit,
          e.hardnessScore,
          e.lengthScore,
          e.importanceScore,
          e.scoringPotential,
          e.frequencyAskedScore,
        ]),
      );

    case 'progress':
      return toCsv(
        ['Topic', 'Completed', 'Revised Count', 'Confidence', 'Mastery Score'],
        resource.data.perTopic.map((t) => [
          t.topic,
          t.completed,
          t.revisedCount,
          t.selfRatedConfidence ?? '',
          t.masteryScore,
        ]),
      );

    case 'doubts':
      return toCsv(
        ['Category', 'Question', 'Expected Answer Points', 'Topic', 'Difficulty'],
        resource.data.doubts.map((d) => [
          d.category,
          d.question,
          d.expectedAnswerPoints.join(' | '),
          d.topic,
          d.difficulty,
        ]),
      );

    case 'roadmap':
      return toCsv(
        ['Topic', 'Priority', 'Difficulty', 'Estimated Hours', 'Reason'],
        resource.data.prioritizedTopics.map((t) => [
          t.topic,
          t.priority,
          t.difficulty,
          t.estimatedHours,
          t.reason,
        ]),
      );

    case 'study_plan':
      return toCsv(
        ['Day', 'Topics', 'Estimated Hours', 'Is Revision Day'],
        resource.data.dailyPlan.map((d) => [d.dayIndex, d.topics.join(' | '), d.estimatedHours, d.isRevisionDay]),
      );

    case 'notes':
      return toCsv(['Line'], resource.data.content.split('\n').map((line) => [line]));

    case 'revision_pack':
      return toCsv(['Line'], resource.data.content.split('\n').map((line) => [line]));

    default: {
      const exhaustiveCheck: never = resource;
      throw new Error(`Unsupported export resource kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
