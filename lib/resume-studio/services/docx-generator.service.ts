/**
 * docx-generator.service.ts
 * Renders a Resume into a Word (.docx) document using the `docx` npm
 * package. Kept structurally parallel to pdf-generator.service.ts so the
 * two engines produce visually consistent output.
 *
 * Install: npm install docx
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import { Resume } from "../models/resume.model";
import { getTemplate } from "../utils/resume-template";
import { formatDateRange } from "../utils/resume-formatter";

const PAGE_CONTENT_WIDTH_TWIPS = 12240 - 720 * 2; // US Letter minus 720-twip margins each side

function sectionHeading(title: string, accentHex: string): Paragraph {
  return new Paragraph({
    text: title.toUpperCase(),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: accentHex.replace("#", "") },
    },
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

/** "Left bold ......... Right muted" on a single line via a right tab stop —
 *  matches the two-column convention (Company/Role, Institution/Dates) seen
 *  in professional single-column resume templates. */
function twoColumnParagraph(left: string, right: string, size = 22): Paragraph {
  return new Paragraph({
    tabStops: [{ type: "right", position: PAGE_CONTENT_WIDTH_TWIPS }],
    children: [
      new TextRun({ text: left, bold: true, size }),
      ...(right ? [new TextRun({ text: `\t${right}`, size: size - 2, color: "595959" })] : []),
    ],
    spacing: { before: 100 },
  });
}

export async function generateResumeDocx(resume: Resume): Promise<Buffer> {
  const template = getTemplate(resume.templateId);
  const accent = template.accentColor.replace("#", "");
  const { content } = resume;

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: content.contact.fullName || "Unnamed Candidate", bold: true, size: 40, color: "141414" }),
      ],
      spacing: { after: 60 },
    })
  );

  if (content.summary?.headline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: content.summary.headline, size: 22, color: "404040" })],
        spacing: { after: 80 },
      })
    );
  }

  const contactLine = [content.contact.location, content.contact.phone, content.contact.email]
    .filter(Boolean)
    .join("   |   ");
  if (contactLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contactLine, size: 20, color: "555555" })],
        spacing: { after: 40 },
      })
    );
  }

  if (content.contact.links.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: content.contact.links.map((l) => l.label || l.url).join("   |   "),
            size: 20,
            color: accent,
          }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  if (content.summary?.summary) {
    children.push(sectionHeading("Summary", template.accentColor));
    children.push(new Paragraph({ text: content.summary.summary, spacing: { after: 120 } }));
  }

  if (content.experience?.length) {
    children.push(sectionHeading("Experience", template.accentColor));
    for (const exp of content.experience) {
      children.push(twoColumnParagraph(exp.company, exp.role, 22));
      const dateStr = formatDateRange(exp.dateRange);
      if (dateStr) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: dateStr, italics: true, size: 18, color: "666666" })],
            spacing: { after: 40 },
          })
        );
      }
      exp.bullets.forEach((b) => children.push(bulletParagraph(b)));
    }
  }

  if (content.projects?.length) {
    children.push(sectionHeading("Projects", template.accentColor));
    for (const proj of content.projects) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: proj.name, bold: true, size: 22 })],
          spacing: { before: 100 },
        })
      );
      proj.bullets.forEach((b) => children.push(bulletParagraph(b)));
    }
  }

  if (content.education?.length) {
    children.push(sectionHeading("Education", template.accentColor));
    for (const edu of content.education) {
      children.push(twoColumnParagraph(edu.institution, formatDateRange(edu.dateRange), 21));
      children.push(
        new Paragraph({
          children: [new TextRun({ text: edu.degree, size: 20, color: "404040" })],
          spacing: { after: 40 },
        })
      );
    }
  }

  if (content.skills?.length) {
    children.push(sectionHeading("Skills", template.accentColor));
    for (const group of content.skills) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${group.category}: `, bold: true }),
            new TextRun({ text: group.items.join(", ") }),
          ],
          spacing: { after: 40 },
        })
      );
    }
  }

  if (content.certificates?.length) {
    children.push(sectionHeading("Certificates", template.accentColor));
    content.certificates.forEach((c) =>
      children.push(bulletParagraph(`${c.name}${c.issuer ? ` — ${c.issuer}` : ""}`))
    );
  }

  if (content.achievements?.length) {
    children.push(sectionHeading("Achievements", template.accentColor));
    content.achievements.forEach((a) => children.push(bulletParagraph(a.title)));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: { run: { size: 20, font: "Calibri" } },
      },
    },
  });

  return Packer.toBuffer(doc);
}
