// lib/assignment/export/docx.export.ts
//
// Peer dependency: npm install docx
// (Distinct from the mammoth-based DOCX *reading* path in parser/text-parsers.ts —
// this is DOCX *writing*, using the `docx` package's document-builder API.)

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import type { ExportableAssignment } from "./exportable-content";

export async function exportToDocx(bundle: ExportableAssignment): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: bundle.document.title,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Subject: ${bundle.document.detectedSubjectArea} · ${bundle.document.questions.length} question(s)`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 300 },
    })
  );

  for (const question of bundle.document.questions) {
    const marksSuffix = question.marks !== null ? ` [${question.marks} marks]` : "";

    children.push(
      new Paragraph({
        text: `Q${question.questionNumber}. ${question.cleanedText}${marksSuffix}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Type: ${question.type} · Difficulty: ${question.difficulty} · Topic: ${question.topic}`,
            italics: true,
            size: 18,
            color: "888888",
          }),
        ],
      })
    );

    if (bundle.includeSolutions) {
      const solution = bundle.solutions.get(question.id);
      if (solution) {
        children.push(...renderSolutionParagraphs(solution, bundle.includeReferences));
      }
    }
  }

  if (bundle.includeQuizzes && bundle.quiz.length > 0) {
    children.push(new Paragraph({ text: "Quiz", heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }));
    bundle.quiz.forEach((q, i) => {
      children.push(new Paragraph({ text: `${i + 1}. ${q.prompt}`, spacing: { before: 150 } }));
      if (q.options) {
        q.options.forEach((opt, oi) => {
          children.push(new Paragraph({ text: `   ${String.fromCharCode(65 + oi)}. ${opt}` }));
        });
      }
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Answer: ${q.correctAnswer} — ${q.explanation}`, italics: true, color: "4a6cf7" })],
        })
      );
    });
  }

  if (bundle.includeFlashcards && bundle.flashcards.length > 0) {
    children.push(new Paragraph({ text: "Flashcards", heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }));
    bundle.flashcards.forEach((c, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. Q: `, bold: true }),
            new TextRun({ text: c.front }),
          ],
          spacing: { before: 150 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "A: ", bold: true }), new TextRun({ text: c.back })],
        })
      );
    });
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

function renderSolutionParagraphs(
  solution: import("../models/types").QuestionSolution,
  includeReferences: boolean
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Understanding the question: ", bold: true }), new TextRun({ text: solution.explanationOfQuestion })],
      spacing: { before: 150 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Approach: ", bold: true }), new TextRun({ text: solution.approach })],
    }),
  ];

  solution.steps.forEach((step) => {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${step.stepNumber}. ${step.title}: `, bold: true }),
          new TextRun({ text: step.explanation }),
        ],
      })
    );
    if (step.formula) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: step.formula, font: "Courier New" })] }));
    }
    if (step.code) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: step.code, font: "Courier New", size: 18 })] }));
    }
  });

  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: "Final answer: ", bold: true }), new TextRun({ text: solution.finalAnswer })],
      spacing: { after: 150 },
    })
  );

  if (includeReferences && solution.references.length > 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "References", bold: true })] }));
    solution.references.forEach((ref, i) => {
      paragraphs.push(new Paragraph({ text: `${i + 1}. ${ref.citationText}`, alignment: AlignmentType.LEFT }));
    });
  }

  return paragraphs;
}
