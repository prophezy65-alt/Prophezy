// lib/assignment/utils/markdown-formatter.ts
import type { DetectedQuestion, QuestionSolution, ReferenceEntry, GlossaryEntry } from "../models/types";

export function formatQuestionAsMarkdown(question: DetectedQuestion): string {
  const marksSuffix = question.marks !== null ? ` [${question.marks} marks]` : "";
  return `### Q${question.questionNumber}. ${question.cleanedText}${marksSuffix}\n\n` +
    `*Type: ${question.type} · Difficulty: ${question.difficulty} · Topic: ${question.topic}*\n`;
}

export function formatSolutionAsMarkdown(solution: QuestionSolution): string {
  const parts: string[] = [];

  parts.push(`**Understanding the question**\n\n${solution.explanationOfQuestion}\n`);
  parts.push(`**Approach**\n\n${solution.approach}\n`);

  if (solution.steps.length > 0) {
    parts.push("**Step-by-step solution**\n");
    for (const step of solution.steps) {
      parts.push(`${step.stepNumber}. **${step.title}** — ${step.explanation}`);
      if (step.formula) parts.push(`   \n   Formula: \`${step.formula}\``);
      if (step.code) {
        parts.push(`   \n   \`\`\`${step.codeLanguage ?? ""}\n${step.code}\n   \`\`\``);
      }
    }
    parts.push("");
  }

  parts.push(`**Final answer**\n\n${solution.finalAnswer}\n`);

  if (solution.keyConcepts.length > 0) {
    parts.push(`**Key concepts**: ${solution.keyConcepts.join(", ")}\n`);
  }

  if (solution.pseudocode) {
    parts.push(`**Pseudocode**\n\n\`\`\`\n${solution.pseudocode}\n\`\`\`\n`);
  }

  if (solution.code) {
    parts.push(`**Code**\n\n\`\`\`${solution.code.language}\n${solution.code.content}\n\`\`\`\n`);
  }

  for (const diagram of solution.mermaidDiagrams) {
    parts.push(`\`\`\`mermaid\n${diagram}\n\`\`\`\n`);
  }

  if (solution.glossary.length > 0) {
    parts.push(formatGlossaryAsMarkdown(solution.glossary));
  }

  if (solution.references.length > 0) {
    parts.push(formatReferencesAsMarkdown(solution.references));
  }

  return parts.join("\n");
}

export function formatGlossaryAsMarkdown(glossary: GlossaryEntry[]): string {
  const lines = glossary.map((g) => `- **${g.term}**: ${g.definition}`);
  return `**Glossary**\n\n${lines.join("\n")}\n`;
}

export function formatReferencesAsMarkdown(references: ReferenceEntry[]): string {
  const lines = references.map((r, i) => `${i + 1}. ${r.citationText}`);
  return `**References**\n\n${lines.join("\n")}\n`;
}

/** Strips markdown syntax down to plain text — used when generating .txt or
 * plain HTML-safe previews where markdown tokens would otherwise leak through. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "") // code fences
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italics
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .trim();
}
