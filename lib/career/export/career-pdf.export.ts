/**
 * career-pdf.export.ts
 * Renders a CareerReport into a PDF using pdf-lib, following the same
 * rendering approach as Resume Studio's pdf-generator.service.ts for
 * visual/architectural consistency across the app.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { CareerReport } from "../utils/export-builder";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ACCENT = rgb(0.145, 0.388, 0.922); // #2563EB

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

export async function generateCareerReportPdf(report: CareerReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Career Guidance Report");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const state: RenderState = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    font,
    boldFont,
    y: PAGE_HEIGHT - MARGIN,
  };

  state.page.drawText("Career Guidance Report", {
    x: MARGIN,
    y: state.y,
    size: 20,
    font: boldFont,
    color: rgb(0.05, 0.05, 0.05),
  });
  state.y -= 22;
  drawWrapped(state, `Generated: ${report.generatedAt}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  state.y -= 8;

  drawHeading(state, "Analytics");
  const a = report.analytics;
  drawWrapped(state, `Skill Score: ${a.skillScore}/100   Readiness: ${a.readinessScore}/100   Career Score: ${a.careerScore}/100`);
  drawWrapped(state, `Resume Strength: ${a.resumeStrength}/100   Learning Progress: ${a.learningProgressPercent}%`);

  if (report.skillGap) {
    drawHeading(state, `Skill Gap Analysis: ${report.skillGap.targetRole}`);
    drawWrapped(state, `Overall readiness: ${report.skillGap.overallReadinessPercent}%`, { bold: true });
    for (const gap of report.skillGap.gaps) {
      drawWrapped(state, `• ${gap.skill} (${gap.priority}): ${gap.currentProficiency} → ${gap.requiredProficiency} — ${gap.reason}`, { indent: 6 });
    }
  }

  if (report.roadmap) {
    drawHeading(state, `Learning Roadmap: ${report.roadmap.targetRole}`);
    drawWrapped(state, `Total estimated time: ${report.roadmap.totalEstimatedWeeks} weeks`, { bold: true });
    for (const m of report.roadmap.milestones) {
      drawWrapped(state, `${m.order + 1}. ${m.title} (${m.estimatedWeeks}w)`, { bold: true });
      drawWrapped(state, m.description, { indent: 6 });
    }
  }

  if (report.recommendations.length) {
    drawHeading(state, "Recommendations");
    for (const rec of report.recommendations) {
      drawWrapped(state, `${rec.title} (${rec.confidenceScore}%)`, { bold: true });
      drawWrapped(state, rec.rationale, { indent: 6 });
    }
  }

  if (report.salaryEstimate) {
    const s = report.salaryEstimate;
    drawHeading(state, `Salary Estimate: ${s.role}`);
    drawWrapped(state, `${s.currency} ${s.low.toLocaleString()} – ${s.high.toLocaleString()} (median ${s.median.toLocaleString()}) in ${s.country}`);
  }

  return doc.save();
}
