/**
 * hackathon-docx.export.ts
 * Renders a HackathonPrepReport into a Word (.docx) document.
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { HackathonPrepReport } from "../utils/export-builder";
import { summarizePrizeStructure } from "../utils/prize-analyzer";

function heading(text: string): Paragraph {
  return new Paragraph({
    text: text.toUpperCase(),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "7C3AED" } },
  });
}

export async function generateHackathonPrepDocx(report: HackathonPrepReport): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: report.hackathon.title, bold: true, size: 32 })], spacing: { after: 60 } }),
    new Paragraph({
      children: [
        new TextRun({ text: `${report.hackathon.organizer.name} · ${report.hackathon.mode} · ${report.hackathon.timeline.submissionDeadline}`, size: 18, color: "666666" }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({ text: summarizePrizeStructure(report.hackathon.prizes), spacing: { after: 100 } }),
    new Paragraph({ text: report.hackathon.description, spacing: { after: 100 } }),
  ];

  if (report.matchScore) {
    children.push(heading("Match Score"));
    children.push(
      new Paragraph({
        text: `Overall: ${report.matchScore.overallMatchPercent}% | Skills: ${report.matchScore.skillMatchPercent}% | Theme: ${report.matchScore.themeMatchPercent}%`,
      })
    );
  }

  if (report.idea) {
    children.push(heading(`Idea: ${report.idea.title}`));
    children.push(new Paragraph({ text: report.idea.pitch, spacing: { after: 60 } }));
    children.push(new Paragraph({ text: `Key features: ${report.idea.keyFeatures.join(", ")}` }));
    children.push(new Paragraph({ text: `Suggested stack: ${report.idea.techStackSuggestion.join(", ")}` }));
  }

  if (report.timeline) {
    children.push(heading("Preparation Timeline"));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Total estimated effort: ${report.timeline.totalEstimatedHours} hours`, bold: true })],
        spacing: { after: 60 },
      })
    );
    report.timeline.milestones.forEach((m) => {
      children.push(
        new Paragraph({ children: [new TextRun({ text: `${m.order + 1}. ${m.title}`, bold: true })], spacing: { before: 80 } })
      );
      children.push(new Paragraph({ text: m.description, spacing: { after: 40 } }));
    });
  }

  if (report.checklist) {
    children.push(heading("Checklist"));
    report.checklist.items.forEach((i) =>
      children.push(new Paragraph({ text: `[${i.done ? "x" : " "}] ${i.label}`, spacing: { after: 30 } }))
    );
  }

  if (report.pitch) {
    children.push(heading("Pitch Outline"));
    children.push(new Paragraph({ children: [new TextRun({ text: `Hook: ${report.pitch.hookLine}`, bold: true })], spacing: { after: 40 } }));
    children.push(new Paragraph({ text: `Problem: ${report.pitch.problemSlide}`, spacing: { after: 40 } }));
    children.push(new Paragraph({ text: `Solution: ${report.pitch.solutionSlide}`, spacing: { after: 40 } }));
    children.push(new Paragraph({ text: `Impact: ${report.pitch.impactSlide}` }));
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
    styles: { default: { document: { run: { size: 20, font: "Calibri" } } } },
  });

  return Packer.toBuffer(doc);
}
