// lib/assignment/export/markdown.export.ts
import type { ExportableAssignment } from "./exportable-content";
import { formatQuestionAsMarkdown, formatSolutionAsMarkdown } from "../utils/markdown-formatter";

export function exportToMarkdown(bundle: ExportableAssignment): string {
  const parts: string[] = [];
  parts.push(`# ${bundle.document.title}\n`);
  parts.push(`*Subject: ${bundle.document.detectedSubjectArea} · ${bundle.document.questions.length} question(s)*\n`);

  for (const question of bundle.document.questions) {
    parts.push("---\n");
    parts.push(formatQuestionAsMarkdown(question));

    if (bundle.includeSolutions) {
      const solution = bundle.solutions.get(question.id);
      if (solution) {
        parts.push(formatSolutionAsMarkdown(solution));
      }
    }
  }

  if (bundle.includeQuizzes && bundle.quiz.length > 0) {
    parts.push("---\n\n## Quiz\n");
    bundle.quiz.forEach((q, i) => {
      parts.push(`${i + 1}. ${q.prompt}`);
      if (q.options) {
        q.options.forEach((opt, oi) => parts.push(`   - ${String.fromCharCode(65 + oi)}. ${opt}`));
      }
      parts.push(`   \n   *Answer: ${q.correctAnswer} — ${q.explanation}*\n`);
    });
  }

  if (bundle.includeFlashcards && bundle.flashcards.length > 0) {
    parts.push("---\n\n## Flashcards\n");
    bundle.flashcards.forEach((c, i) => {
      parts.push(`${i + 1}. **Q:** ${c.front}  \n   **A:** ${c.back}  \n   *(${c.topic})*\n`);
    });
  }

  return parts.join("\n");
}
