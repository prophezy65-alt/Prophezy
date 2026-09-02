/**
 * career-docx.export.ts
 * Renders a CareerReport into a Word (.docx) document.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { CareerReport } from "../utils/export-builder";

function heading(text: string): Paragraph {
  return new Paragraph({
    text: text.toUpperCase(),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2563EB" } },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } });
}

export async function generateCareerReportDocx(report: CareerReport): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Career Guidance Report", bold: true, size: 36 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${report.generatedAt}`, size: 18, color: "666666" })],
      spacing: { after: 120 },
    }),
  ];

  const a = report.analytics;
  children.push(heading("Analytics"));
  children.push(
    new Paragraph({
      text: `Skill Score: ${a.skillScore}/100 | Readiness: ${a.readinessScore}/100 | Career Score: ${a.careerScore}/100`,
    })
  );
  children.push(
    new Paragraph({
      text: `Resume Strength: ${a.resumeStrength}/100 | Learning Progress: ${a.learningProgressPercent}%`,
      spacing: { after: 100 },
    })
  );

  if (report.skillGap) {
    children.push(heading(`Skill Gap Analysis: ${report.skillGap.targetRole}`));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Overall readiness: ${report.skillGap.overallReadinessPercent}%`, bold: true })],
        spacing: { after: 60 },
      })
    );
    report.skillGap.gaps.forEach((gap) =>
      children.push(bullet(`${gap.skill} (${gap.priority}): ${gap.currentProficiency} → ${gap.requiredProficiency} — ${gap.reason}`))
    );
  }

  if (report.roadmap) {
    children.push(heading(`Learning Roadmap: ${report.roadmap.targetRole}`));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Total estimated time: ${report.roadmap.totalEstimatedWeeks} weeks`, bold: true })],
        spacing: { after: 60 },
      })
    );
    report.roadmap.milestones.forEach((m) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${m.order + 1}. ${m.title} (${m.estimatedWeeks}w)`, bold: true })],
          spacing: { before: 80 },
        })
      );
      children.push(new Paragraph({ text: m.description, spacing: { after: 40 } }));
    });
  }

  if (report.recommendations.length) {
    children.push(heading("Recommendations"));
    report.recommendations.forEach((rec) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${rec.title} (${rec.confidenceScore}%)`, bold: true })],
          spacing: { before: 80 },
        })
      );
      children.push(new Paragraph({ text: rec.rationale, spacing: { after: 40 } }));
    });
  }

  if (report.salaryEstimate) {
    const s = report.salaryEstimate;
    children.push(heading(`Salary Estimate: ${s.role}`));
    children.push(
      new Paragraph({
        text: `${s.currency} ${s.low.toLocaleString()} – ${s.high.toLocaleString()} (median ${s.median.toLocaleString()}) in ${s.country}`,
      })
    );
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
    styles: { default: { document: { run: { size: 20, font: "Calibri" } } } },
  });

  return Packer.toBuffer(doc);
}
