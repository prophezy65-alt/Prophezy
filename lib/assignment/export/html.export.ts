// lib/assignment/export/html.export.ts
import type { ExportableAssignment } from "./exportable-content";
import type { DetectedQuestion, QuestionSolution } from "../models/types";

export function exportToHtml(bundle: ExportableAssignment): string {
  const questionBlocks = bundle.document.questions
    .map((q) => renderQuestionHtml(q, bundle.includeSolutions ? bundle.solutions.get(q.id) : undefined, bundle.includeReferences))
    .join("\n");

  const quizBlock = bundle.includeQuizzes && bundle.quiz.length > 0 ? renderQuizHtml(bundle) : "";
  const flashcardBlock = bundle.includeFlashcards && bundle.flashcards.length > 0 ? renderFlashcardsHtml(bundle) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(bundle.document.title)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 1.8rem; border-bottom: 2px solid #eee; padding-bottom: 8px; }
  .question { border: 1px solid #e2e2e2; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 8px; }
  .solution { background: #f8f9fb; border-left: 3px solid #4a6cf7; padding: 12px 16px; margin-top: 12px; border-radius: 4px; }
  code, pre { background: #f2f2f2; border-radius: 4px; padding: 2px 6px; }
  pre { padding: 12px; overflow-x: auto; }
  .quiz-item, .flashcard { margin: 12px 0; padding: 10px 14px; background: #fafafa; border-radius: 6px; }
</style>
</head>
<body>
<h1>${escapeHtml(bundle.document.title)}</h1>
<p class="meta">Subject: ${escapeHtml(bundle.document.detectedSubjectArea)} · ${bundle.document.questions.length} question(s)</p>
${questionBlocks}
${quizBlock}
${flashcardBlock}
</body>
</html>`;
}

function renderQuestionHtml(question: DetectedQuestion, solution: QuestionSolution | undefined, includeReferences: boolean): string {
  const marks = question.marks !== null ? ` [${question.marks} marks]` : "";
  let solutionHtml = "";

  if (solution) {
    const steps = solution.steps
      .map(
        (s) =>
          `<li><strong>${escapeHtml(s.title)}:</strong> ${escapeHtml(s.explanation)}${
            s.formula ? `<br/><code>${escapeHtml(s.formula)}</code>` : ""
          }${s.code ? `<pre><code>${escapeHtml(s.code)}</code></pre>` : ""}</li>`
      )
      .join("");

    const referencesHtml =
      includeReferences && solution.references.length > 0
        ? `<p><strong>References:</strong></p><ol>${solution.references
            .map((r) => `<li>${escapeHtml(r.citationText)}</li>`)
            .join("")}</ol>`
        : "";

    solutionHtml = `<div class="solution">
      <p><strong>Understanding the question:</strong> ${escapeHtml(solution.explanationOfQuestion)}</p>
      <p><strong>Approach:</strong> ${escapeHtml(solution.approach)}</p>
      <ol>${steps}</ol>
      <p><strong>Final answer:</strong> ${escapeHtml(solution.finalAnswer)}</p>
      ${referencesHtml}
    </div>`;
  }

  return `<div class="question">
    <p class="meta">Q${escapeHtml(question.questionNumber)} · ${escapeHtml(question.type)} · ${escapeHtml(question.difficulty)}</p>
    <p>${escapeHtml(question.cleanedText)}${marks}</p>
    ${solutionHtml}
  </div>`;
}

function renderQuizHtml(bundle: ExportableAssignment): string {
  const items = bundle.quiz
    .map(
      (q, i) =>
        `<div class="quiz-item"><strong>${i + 1}. ${escapeHtml(q.prompt)}</strong>${
          q.options ? `<ul>${q.options.map((o) => `<li>${escapeHtml(o)}</li>`).join("")}</ul>` : ""
        }<p><em>Answer: ${escapeHtml(q.correctAnswer)} — ${escapeHtml(q.explanation)}</em></p></div>`
    )
    .join("");
  return `<h2>Quiz</h2>${items}`;
}

function renderFlashcardsHtml(bundle: ExportableAssignment): string {
  const items = bundle.flashcards
    .map((c) => `<div class="flashcard"><strong>Q:</strong> ${escapeHtml(c.front)}<br/><strong>A:</strong> ${escapeHtml(c.back)}</div>`)
    .join("");
  return `<h2>Flashcards</h2>${items}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
