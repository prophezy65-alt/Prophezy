/**
 * lib/interview/export/export.service.ts
 *
 * Builds a downloadable report from a completed session. Markdown/JSON are
 * pure string builders. PDF uses `pdfkit`, DOCX uses `docx` — both are
 * plain npm packages, added here rather than assumed to exist elsewhere,
 * since no shared document-export utility path was provided. If
 * Resume Studio already exposes one, prefer wiring these two branches to
 * that instead of the `pdfkit`/`docx` dependency.
 */
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import type { InterviewEvaluation, InterviewQuestion, InterviewSession } from "../models/interview.model";

export interface SessionReportBundle {
  session: InterviewSession;
  items: {
    question: InterviewQuestion;
    answerText: string;
    evaluation: InterviewEvaluation;
  }[];
  overallScore: number;
}

export function buildMarkdownReport(bundle: SessionReportBundle): string {
  const lines: string[] = [
    `# Interview Report — ${bundle.session.role}`,
    "",
    `**Type:** ${bundle.session.interviewType}  `,
    `**Seniority:** ${bundle.session.seniority}  `,
    bundle.session.company ? `**Company:** ${bundle.session.company}  ` : "",
    `**Overall score:** ${bundle.overallScore}/10`,
    "",
    "---",
    "",
  ];

  bundle.items.forEach((item, i) => {
    lines.push(`## Question ${i + 1}: ${item.question.question}`);
    lines.push("");
    lines.push(`*Topic: ${item.question.topic} · Difficulty: ${item.question.difficulty}*`);
    lines.push("");
    lines.push(`**Your answer:** ${item.answerText}`);
    lines.push("");
    lines.push(`**Score:** ${item.evaluation.overallScore}/10`);
    lines.push("");
    lines.push(`**Strengths:** ${item.evaluation.strengths.join("; ")}`);
    lines.push(`**Weaknesses:** ${item.evaluation.weaknesses.join("; ")}`);
    lines.push("");
    lines.push(`**Model answer:** ${item.evaluation.modelAnswer}`);
    lines.push("");
    lines.push(`**Improvement plan:** ${item.evaluation.improvementPlan}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

export function buildJsonReport(bundle: SessionReportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function buildPdfReport(bundle: SessionReportBundle): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text(`Interview Report — ${bundle.session.role}`, { underline: true });
    doc.moveDown(0.5);
    doc
      .fontSize(11)
      .text(`Type: ${bundle.session.interviewType}    Seniority: ${bundle.session.seniority}`)
      .text(bundle.session.company ? `Company: ${bundle.session.company}` : "")
      .text(`Overall score: ${bundle.overallScore}/10`);
    doc.moveDown();

    bundle.items.forEach((item, i) => {
      doc.fontSize(14).text(`Question ${i + 1}: ${item.question.question}`, { underline: true });
      doc.fontSize(10).fillColor("gray").text(`Topic: ${item.question.topic} · Difficulty: ${item.question.difficulty}`);
      doc.fillColor("black");
      doc.moveDown(0.3);
      doc.fontSize(11).text(`Your answer: ${item.answerText}`);
      doc.moveDown(0.3);
      doc.text(`Score: ${item.evaluation.overallScore}/10`);
      doc.text(`Strengths: ${item.evaluation.strengths.join("; ")}`);
      doc.text(`Weaknesses: ${item.evaluation.weaknesses.join("; ")}`);
      doc.moveDown(0.3);
      doc.text(`Model answer: ${item.evaluation.modelAnswer}`);
      doc.moveDown(0.3);
      doc.text(`Improvement plan: ${item.evaluation.improvementPlan}`);
      doc.moveDown();
      doc.moveTo(doc.x, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
      doc.moveDown();
    });

    doc.end();
  });
}

export async function buildDocxReport(bundle: SessionReportBundle): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: `Interview Report — ${bundle.session.role}`,
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun(
          `Type: ${bundle.session.interviewType}    Seniority: ${bundle.session.seniority}` +
            (bundle.session.company ? `    Company: ${bundle.session.company}` : "")
        ),
      ],
    }),
    new Paragraph({ children: [new TextRun(`Overall score: ${bundle.overallScore}/10`)] }),
  ];

  bundle.items.forEach((item, i) => {
    children.push(
      new Paragraph({ text: `Question ${i + 1}: ${item.question.question}`, heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: `Topic: ${item.question.topic} · Difficulty: ${item.question.difficulty}` }),
      new Paragraph({ children: [new TextRun({ text: `Your answer: `, bold: true }), new TextRun(item.answerText)] }),
      new Paragraph({ children: [new TextRun({ text: `Score: `, bold: true }), new TextRun(`${item.evaluation.overallScore}/10`)] }),
      new Paragraph({
        children: [new TextRun({ text: `Strengths: `, bold: true }), new TextRun(item.evaluation.strengths.join("; "))],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Weaknesses: `, bold: true }), new TextRun(item.evaluation.weaknesses.join("; "))],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Model answer: `, bold: true }), new TextRun(item.evaluation.modelAnswer)],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Improvement plan: `, bold: true }), new TextRun(item.evaluation.improvementPlan)],
      })
    );
  });

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
