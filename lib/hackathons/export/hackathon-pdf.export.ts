/**
 * hackathon-pdf.export.ts
 * Renders a HackathonPrepReport into a PDF using pdf-lib, following the
 * same rendering approach as Resume Studio / Career Guidance for
 * consistency across the app.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { HackathonPrepReport } from "../utils/export-builder";
import { summarizePrizeStructure } from "../utils/prize-analyzer";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ACCENT = rgb(0.486, 0.227, 0.929); // #7C3AED

interface RenderState {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
}

function newPage(state: RenderState): void {
  state.page = state.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(state: RenderState, needed: number): void {
  if (state.y - needed < MARGIN) newPage(state);
}

function drawWrapped(
  state: RenderState,
  text: string,
  opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}
): void {
  const { size = 10, bold = false, color = rgb(0.1, 0.1, 0.1), indent = 0 } = opts;
  const font = bold ? state.boldFont : state.font;
  const maxWidth = CONTENT_WIDTH - indent;

  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  for (const l of lines) {
    ensureSpace(state, size + 4);
    state.page.drawText(l, { x: MARGIN + indent, y: state.y, size, font, color });
    state.y -= size + 4;
  }
}

function drawHeading(state: RenderState, text: string, size = 14): void {
  ensureSpace(state, size + 12);
  state.y -= 6;
  state.page.drawText(text, { x: MARGIN, y: state.y, size, font: state.boldFont, color: ACCENT });
  state.y -= size + 6;
}

export async function generateHackathonPrepPdf(report: HackathonPrepReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${report.hackathon.title} — Prep Report`);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const state: RenderState = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    boldFont,
    y: PAGE_HEIGHT - MARGIN,
  };

  state.page.drawText(report.hackathon.title, { x: MARGIN, y: state.y, size: 18, font: boldFont, color: rgb(0.05, 0.05, 0.05) });
  state.y -= 22;
  drawWrapped(state, `Organizer: ${report.hackathon.organizer.name} · Mode: ${report.hackathon.mode}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  drawWrapped(state, `Deadline: ${report.hackathon.timeline.submissionDeadline}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  drawWrapped(state, summarizePrizeStructure(report.hackathon.prizes), { size: 9, color: rgb(0.4, 0.4, 0.4) });
  state.y -= 6;
  drawWrapped(state, report.hackathon.description);

  if (report.matchScore) {
    drawHeading(state, "Match Score");
    drawWrapped(state, `Overall: ${report.matchScore.overallMatchPercent}% · Skills: ${report.matchScore.skillMatchPercent}% · Theme: ${report.matchScore.themeMatchPercent}%`);
  }

  if (report.idea) {
    drawHeading(state, `Idea: ${report.idea.title}`);
    drawWrapped(state, report.idea.pitch);
    drawWrapped(state, `Key features: ${report.idea.keyFeatures.join(", ")}`, { indent: 6 });
    drawWrapped(state, `Suggested stack: ${report.idea.techStackSuggestion.join(", ")}`, { indent: 6 });
  }

  if (report.timeline) {
    drawHeading(state, "Preparation Timeline");
    drawWrapped(state, `Total estimated effort: ${report.timeline.totalEstimatedHours} hours`, { bold: true });
    for (const m of report.timeline.milestones) {
      drawWrapped(state, `${m.order + 1}. ${m.title}`, { bold: true });
      drawWrapped(state, m.description, { indent: 6 });
    }
  }

  if (report.checklist) {
    drawHeading(state, "Checklist");
    for (const i of report.checklist.items) {
      drawWrapped(state, `[${i.done ? "x" : " "}] ${i.label}`, { indent: 4 });
    }
  }

  if (report.pitch) {
    drawHeading(state, "Pitch Outline");
    drawWrapped(state, `Hook: ${report.pitch.hookLine}`, { bold: true });
    drawWrapped(state, `Problem: ${report.pitch.problemSlide}`);
    drawWrapped(state, `Solution: ${report.pitch.solutionSlide}`);
    drawWrapped(state, `Impact: ${report.pitch.impactSlide}`);
  }

  return doc.save();
}
