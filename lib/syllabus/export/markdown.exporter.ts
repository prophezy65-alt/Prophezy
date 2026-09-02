/**
 * lib/syllabus/export/markdown.exporter.ts
 *
 * Renders any ExportableResource to markdown. This is also the
 * common intermediate representation the DOCX and PDF exporters
 * render from, so formatting logic for each resource kind lives in
 * exactly one place.
 */

import type { ExportableResource } from '../models/syllabus.types';

function heading(text: string, level: 1 | 2 | 3 = 2): string {
  return `${'#'.repeat(level)} ${text}\n`;
}

function bulletList(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n') + '\n';
}

function table(headers: string[], rows: (string | number)[][]): string {
  const headerLine = `| ${headers.join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyLines = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, dividerLine, ...bodyLines].join('\n') + '\n';
}

export function renderResourceToMarkdown(resource: ExportableResource): string {
  switch (resource.kind) {
    case 'syllabus': {
      const s = resource.data;
      return [
        heading(s.subjectName, 1),
        `**Course code:** ${s.courseCode ?? '—'}  \n**University:** ${s.university ?? '—'}  \n**Semester:** ${s.semester ?? '—'}  \n**Credits:** ${s.credits ?? '—'}`,
        heading('Units'),
        s.units
          .map((u) => `**Unit ${u.unitNumber}: ${u.title}**\n${bulletList(u.topics)}`)
          .join('\n'),
        heading('Practicals'),
        bulletList(s.practicals.map((p) => p.title)),
        heading('Marks Distribution'),
        table(
          ['Component', 'Marks', 'Weightage %'],
          s.marksDistribution.map((m) => [m.component, m.marks, m.weightagePercent ?? '—']),
        ),
        heading('References'),
        bulletList(s.references.map((r) => `${r.title}${r.author ? ` — ${r.author}` : ''}`)),
      ].join('\n');
    }

    case 'roadmap': {
      const r = resource.data;
      return [
        heading('Smart Roadmap', 1),
        `**Total days:** ${r.totalDays}  \n**Exam countdown:** ${r.examCountdown.daysRemaining} days remaining (${r.examCountdown.riskLevel})  \n${r.examCountdown.message}`,
        heading('Prioritized Topics'),
        table(
          ['Topic', 'Priority', 'Difficulty', 'Est. Hours'],
          r.prioritizedTopics.map((t) => [t.topic, t.priority, t.difficulty, t.estimatedHours]),
        ),
        heading('Daily Plan'),
        r.dailyPlan
          .map((d) => `**Day ${d.dayIndex}${d.isRevisionDay ? ' (Revision)' : ''}:** ${d.topics.join(', ')} (${d.estimatedHours}h)`)
          .join('\n\n'),
      ].join('\n');
    }

    case 'study_plan': {
      const p = resource.data;
      return [
        heading('Adaptive Study Plan', 1),
        `**Remaining days:** ${p.remainingDays}  \n**Hours/day:** ${p.hoursPerDay}  \n**Total hours required:** ${p.totalHoursRequired}`,
        heading('Weak Topic Allocation'),
        table(['Topic', 'Hours'], p.weakTopicAllocation.map((w) => [w.topic, w.hoursAllocated])),
        heading('Recovery Plan'),
        p.recoveryPlan.note,
      ].join('\n');
    }

    case 'notes': {
      const n = resource.data;
      return [heading(`${n.topic} — ${n.variant.replace('_', ' ')} notes`, 1), n.content].join('\n');
    }

    case 'flashcards': {
      const f = resource.data;
      return [
        heading(`Flashcards — ${f.topic}`, 1),
        f.cards.map((c, i) => `**${i + 1}. ${c.front}**\n${c.back}`).join('\n\n'),
      ].join('\n');
    }

    case 'quiz': {
      const q = resource.data;
      return [
        heading('Quiz', 1),
        `**Total marks:** ${q.totalMarks}`,
        q.questions
          .map(
            (question, i) =>
              `**Q${i + 1} (${question.marks} marks, ${question.type}).** ${question.question}` +
              (question.options ? `\n${bulletList(question.options)}` : '') +
              `\n*Answer:* ${question.correctAnswer}\n*Explanation:* ${question.explanation}`,
          )
          .join('\n\n'),
      ].join('\n');
    }

    case 'paper_prediction': {
      const p = resource.data;
      return [
        heading('Previous Paper Prediction', 1),
        heading('Most Important Topics'),
        table(
          ['Topic', 'Probability %', 'Predicted Marks', 'Reason'],
          p.mostImportantTopics.map((t) => [t.topic, t.probabilityScore, t.predictedMarks, t.reason]),
        ),
        heading('Expected Questions'),
        bulletList(p.expectedQuestions.map((q) => `${q.question} (${q.probabilityScore}%, ${q.expectedMarks} marks)`)),
      ].join('\n');
    }

    case 'pyq_map': {
      const m = resource.data;
      return [
        heading('PYQ Coverage Map', 1),
        `**Coverage:** ${m.coverageSummary.coveragePercent}% (${m.coverageSummary.coveredCount} covered, ${m.coverageSummary.partialCount} partial, ${m.coverageSummary.notCoveredCount} not covered)`,
        table(
          ['Syllabus Topic', 'Coverage', 'Notes'],
          m.entries.map((e) => [e.syllabusTopic, e.coverageStatus, e.notes]),
        ),
      ].join('\n');
    }

    case 'revision_pack': {
      const r = resource.data;
      return [heading(`Revision Pack — ${r.mode.replace('_', ' ')}`, 1), r.content, ...(r.keyFormulas ? [heading('Key Formulas'), bulletList(r.keyFormulas)] : [])].join('\n');
    }

    case 'doubts': {
      const d = resource.data;
      return [
        heading('Doubts & Practice Questions', 1),
        d.doubts
          .map((doubt) => `**[${doubt.category}] ${doubt.question}**\n${bulletList(doubt.expectedAnswerPoints)}`)
          .join('\n\n'),
      ].join('\n');
    }

    case 'progress': {
      const p = resource.data;
      return [
        heading('Progress Snapshot', 1),
        `**Completion:** ${p.completionPercent}%  \n**Revision:** ${p.revisionPercent}%  \n**Confidence:** ${p.confidencePercent}%  \n**Mastery:** ${p.masteryPercent}%  \n**Exam readiness:** ${p.estimatedExamReadiness.band} (${p.estimatedExamReadiness.score})`,
        table(
          ['Topic', 'Completed', 'Mastery'],
          p.perTopic.map((t) => [t.topic, t.completed ? 'Yes' : 'No', t.masteryScore]),
        ),
      ].join('\n');
    }

    case 'analytics': {
      const a = resource.data;
      return [
        heading('Smart Analytics', 1),
        heading('Hardest Chapters'),
        bulletList(a.hardestChapters),
        heading('Most Important Chapters'),
        bulletList(a.mostImportantChapters),
        heading('Most Scoring Chapters'),
        bulletList(a.mostScoringChapters),
        heading('Most Asked Chapters'),
        bulletList(a.mostAskedChapters),
      ].join('\n');
    }

    default: {
      const exhaustiveCheck: never = resource;
      throw new Error(`Unsupported export resource kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
