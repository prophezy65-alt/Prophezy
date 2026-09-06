/**
 * resume-parser.ts
 * Pure text -> structured-content extraction. Takes raw text (already
 * extracted from PDF/DOCX/OCR by parser.service.ts) and pulls out contact
 * info, links, and best-guess section boundaries using heuristics/regex.
 *
 * This is intentionally regex/heuristic based (no AI call) so parsing is
 * instant and free. parser.service.ts optionally refines the result with
 * Gemini for messy/unusual formats.
 */

import {
  ResumeContent,
  ContactInfo,
  Link,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  SkillGroup,
} from "../models/resume.model";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const URL_REGEX = /(https?:\/\/[^\s,]+|(?:www\.)?(?:linkedin\.com|github\.com)[^\s,]+)/gi;
// Non-global twin of URL_REGEX for boolean .test() checks below — a
// global regex's .test() carries lastIndex state across calls, which
// silently skips/misfires on alternating calls (e.g. every other bullet
// line). extractLinks() below still uses the global version for .match(),
// which is unaffected by this issue.
const URL_TEST_REGEX = /(https?:\/\/[^\s,]+|(?:www\.)?(?:linkedin\.com|github\.com)[^\s,]+)/i;

// Matches a date-range fragment sitting inside a line — "Jun 2026–July
// 2026", "Jul 2025 - Oct 2025", "May 2026-Present", bare "2019 - 2023",
// etc. Used for two things below: (1) actually populating dateRange
// instead of always leaving it blank, and (2) detecting where one job
// entry ends and the next begins in resumes that put the company+dates
// line AFTER the bullets rather than before them (see the merged-entries
// branch inside parseExperienceBlock below).
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE_TOKEN = `(?:${MONTH}\\.?\\s+\\d{4}|\\d{4})`;
// FIX (bug: "internship start date detected, not end date"): the
// separator only matched dash-family characters (-, –, —). Resumes that
// write ranges as "Jun 2025 to Aug 2025" (word "to" instead of a dash)
// failed the WHOLE regex before, meaning the parser fell back to reading
// only a bare start-date-shaped token elsewhere on the line/next line —
// which looked like "start captured, end missing". Now "to"/"until" are
// accepted alongside dash characters.
const RANGE_SEP = "(?:[-–—]+|\\s+to\\s+|\\s+until\\s+)";
const DATE_RANGE_REGEX = new RegExp(`${DATE_TOKEN}\\s*${RANGE_SEP}\\s*(?:${DATE_TOKEN}|present|current)`, "i");
const MONTH_NUMBERS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/**
 * Normalizes one date token ("Jul 2025", "2025", "Present") to a
 * consistent "YYYY-MM" (or bare "YYYY" if no month was written) so the
 * resume editor always shows the same format regardless of how the
 * original PDF wrote it — a customer specifically asked for this
 * ("diff way me bhi kisi ne likha ho skta, jaise maine Jul 2025 - Oct
 * 2025 aise likha h": different people write dates differently, this
 * should still work). Returns null for "present"/"current" — that's
 * handled as isCurrent instead of an end date.
 */
function normalizeDateToken(token: string): string | null {
  const t = token.trim().toLowerCase();
  if (t === "present" || t === "current") return null;
  // FIX: previously anchored to the WHOLE string (^...$), so an end token
  // with any trailing text attached (e.g. "Aug 2025 (Internship)", "2025.")
  // matched nothing and silently returned null — looking like "start date
  // detected, end date missing" even though the end date was right there.
  // Searching for the date pattern anywhere in the token (not anchored to
  // the end) fixes this while still requiring it to start the token.
  const monthMatch = t.match(/^([a-z]+)\.?\s+(\d{4})/);
  if (monthMatch) {
    const monthKey = monthMatch[1]!.slice(0, 3);
    const num = MONTH_NUMBERS[monthKey];
    return num ? `${monthMatch[2]}-${num}` : monthMatch[2]!;
  }
  const yearOnly = t.match(/^\d{4}/);
  return yearOnly ? yearOnly[0] : null;
}

interface ExtractedDateRange {
  start: string;
  end: string | null;
  isCurrent: boolean;
  /** The rest of the line with the date-range text removed — typically
   *  the company/organization name that shared the line with the dates. */
  remainder: string;
}

function extractDateRangeFromLine(line: string): ExtractedDateRange | null {
  const match = line.match(DATE_RANGE_REGEX);
  if (!match) return null;

  const full = match[0];
  // Split on the same separator set the regex matched on (dash chars, or
  // the words "to"/"until") — previously this only split on dashes, so a
  // "to"/"until" range that now matches DATE_RANGE_REGEX above would fail
  // to split into two tokens here and silently produce no usable range.
  const parts = full.split(new RegExp(RANGE_SEP, "i")).map((p) => p.trim());
  const startToken = parts[0] ?? "";
  const endToken = parts[1] ?? "";
  const isCurrent = /present|current/i.test(endToken);

  const remainder = (line.slice(0, match.index) + line.slice((match.index ?? 0) + full.length))
    .replace(/[,|]\s*$/, "")
    .trim();

  return {
    start: normalizeDateToken(startToken) ?? "",
    end: isCurrent ? null : normalizeDateToken(endToken),
    isCurrent,
    remainder,
  };
}

// Every one of these mirrors an exact limit in
// lib/resume-studio/validation/resume.validation.ts (createResumeSchema).
// A customer's PDF triggered "[resume-studio CREATE] validation failed"
// with a 400 immediately after import "succeeded" — this parser is
// heuristic/regex-based over arbitrary uploaded PDFs, so it WILL
// eventually produce a bullet array too long, a name too long, etc. for
// some real-world resume layout no matter how the heuristics are tuned
// (the concrete trigger here: a project section with no full blank line
// between entries merges multiple projects into one bullet list, easily
// exceeding the 10-bullet cap). Rather than chase each individual layout
// that can exceed a limit, every field the parser fills in is clamped
// here to the schema's own limits, so parsed output can never fail that
// validation — worst case a very long bullet gets truncated or a long
// list gets trimmed, which is always safe and always better than a hard
// 400 that blocks the upload entirely.
const LIMITS = {
  name: 120,
  email: 200,
  phone: 30,
  linkLabel: 60,
  linkUrl: 500,
  linksMax: 10,
  summary: 2000,
  companyOrRole: 200,
  degreeOrInstitution: 200,
  bulletLen: 400,
  experienceBulletsMax: 15,
  projectBulletsMax: 10,
  category: 80,
  skillItem: 60,
  skillItemsMax: 50,
  projectName: 200,
};

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function clampList<T>(list: T[], max: number): T[] {
  return list.length > max ? list.slice(0, max) : list;
}

// Some PDF extractors (particularly for resumes with generous line-spacing
// between bullets) insert a blank-line gap between individual bullets of
// the SAME entry, not just between different entries — a customer's PDF
// did exactly this, and every bullet under one project became its own
// separate project entry (report: "ek hi project ke bullets alag-alag
// project ban rhe h"). A chunk whose first line starts with a bullet
// marker is never a genuine entry title, so merge it back into the
// previous chunk instead of letting it start a new entry. Shared by both
// parseExperienceBlock and parseProjectsBlock below since either section
// can hit this depending on the source PDF's line spacing.
function mergeBulletContinuationChunks(rawChunks: string[]): string[] {
  const chunks: string[] = [];
  for (const raw of rawChunks) {
    const firstLine = raw.split("\n")[0]?.trim() ?? "";
    // FIX (bug: "same project's bullets becoming separate projects"): the
    // old check only recognized "- • *" as bullet markers. Many PDF
    // extractors emit other glyphs for bullets (●, ▪, ‣, ◦, ·, ○, ➤, »),
    // and any of those went unrecognized, so every bullet under one
    // project/job got treated as the start of a brand-new entry whenever
    // there was a blank line between bullets. Broadened to cover the
    // common set.
    if (chunks.length > 0 && /^[-•*●▪‣◦·○➤»]\s+/.test(firstLine)) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}\n${raw}`;
    } else {
      chunks.push(raw);
    }
  }
  return chunks;
}

// "introduction" added — a customer's resume used "INTRODUCTION" as their
// summary heading and it was silently dropped (matched no header, so its
// entire block fell into whatever section preceded it), which then made
// the ATS "Sections" check report summary as missing even though a
// perfectly good summary paragraph was right there under that heading.
const SECTION_HEADERS: Record<string, RegExp> = {
  summary: /^(summary|objective|profile|about|introduction)\b/i,
  experience: /^(experience|work experience|employment history|professional experience)\b/i,
  education: /^(education|academic background)\b/i,
  projects: /^(projects|personal projects|academic projects)\b/i,
  skills: /^(skills|technical skills|technologies|core competencies)\b/i,
  certificates: /^(certificates|certifications|licenses)\b/i,
  achievements: /^(achievements|awards|honors)\b/i,
};

function extractLinks(text: string): Link[] {
  const matches = text.match(URL_REGEX) ?? [];
  const unique = [...new Set(matches)];
  const links = unique.map((url) => {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    let type: Link["type"] = "other";
    if (/github\.com/i.test(url)) type = "github";
    else if (/linkedin\.com/i.test(url)) type = "linkedin";
    return {
      label: clamp(type === "other" ? "Website" : type, LIMITS.linkLabel),
      url: clamp(normalized, LIMITS.linkUrl),
      type,
    };
  });
  return clampList(links, LIMITS.linksMax);
}

// A resume's contact block isn't always "name on line 1" — two-column
// layouts in particular often get their lines extracted out of visual
// order by the PDF text layer, and a name preceded by a blank/odd line
// broke the old lines[0]-only check (a customer reported their name not
// being detected despite it clearly being on the resume). This scans the
// first few non-empty lines instead of trusting only the first one, and
// skips anything that looks like an email/phone/URL/link rather than a
// human name.
function looksLikeName(line: string): boolean {
  if (!line || line.length >= 60) return false;
  if (EMAIL_REGEX.test(line) || PHONE_REGEX.test(line) || URL_TEST_REGEX.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  const letters = line.replace(/[^a-zA-Z]/g, "").length;
  return letters / line.length > 0.6;
}

function extractContact(text: string): ContactInfo {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let fullName = "";
  for (const line of lines.slice(0, 5)) {
    if (looksLikeName(line)) {
      fullName = line;
      break;
    }
  }

  const emailMatch = text.match(EMAIL_REGEX);
  const phoneMatch = text.match(PHONE_REGEX);
  const links = extractLinks(text);

  return {
    fullName: clamp(fullName, LIMITS.name),
    email: emailMatch?.[0] ? clamp(emailMatch[0], LIMITS.email) : undefined,
    phone: phoneMatch?.[0] ? clamp(phoneMatch[0], LIMITS.phone) : undefined,
    links,
  };
}

/**
 * Splits raw resume text into named sections based on header line matches.
 * Returns a map of section name -> raw block text.
 */
export function splitIntoSections(text: string): Record<string, string> {
  const lines = text.split("\n");
  const sections: Record<string, string[]> = {};
  let currentSection = "header";
  sections[currentSection] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const matchedSection = Object.entries(SECTION_HEADERS).find(([, regex]) =>
      regex.test(trimmed)
    );

    if (matchedSection && trimmed.length < 40) {
      currentSection = matchedSection[0];
      sections[currentSection] = sections[currentSection] ?? [];
      // FIX (bug: "Education not detected", could affect any section):
      // when a PDF/DOCX squashes a section header and its first line of
      // content onto the SAME visual line (common in dense/2-column
      // layouts, e.g. "EDUCATION  B.Tech in Computer Science, XYZ
      // University"), the header regex still matches (it only checks the
      // start of the line), but the code used to just `continue`, silently
      // discarding everything after the header keyword. Now the remainder
      // of that line (after the matched header text) is kept and becomes
      // the first line of the new section instead of being thrown away.
      const headerRegex = SECTION_HEADERS[matchedSection[0]]!;
      const afterHeader = trimmed.replace(headerRegex, "").replace(/^[:\-–—\s]+/, "").trim();
      if (afterHeader) {
        sections[currentSection]!.push(afterHeader);
      }
      continue;
    }

    sections[currentSection] = sections[currentSection] ?? [];
    sections[currentSection]!.push(line);
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, val]) => [key, val.join("\n").trim()])
  );
}

function parseSkillsBlock(block: string): SkillGroup[] {
  if (!block) return [];
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const groups: SkillGroup[] = [];
  let idx = 0;

  for (const line of lines) {
    const colonSplit = line.split(":");
    if (colonSplit.length === 2) {
      groups.push({
        id: `skill-${idx++}`,
        category: clamp(colonSplit[0]!.trim(), LIMITS.category),
        items: clampList(
          colonSplit[1]!.split(/[,•]/).map((s) => clamp(s.trim(), LIMITS.skillItem)).filter(Boolean),
          LIMITS.skillItemsMax
        ),
      });
    } else {
      groups.push({
        id: `skill-${idx++}`,
        category: "Skills",
        items: clampList(
          line.split(/[,•]/).map((s) => clamp(s.trim(), LIMITS.skillItem)).filter(Boolean),
          LIMITS.skillItemsMax
        ),
      });
    }
  }

  return groups;
}

// A customer's resume puts each job's title FIRST, then its bullets, then
// a "Company, DateRange" line — and only THEN starts the next job title,
// all without a blank line anywhere in between. The old chunk-per-blank-
// line logic saw that whole block as ONE entry, with every other job's
// bullets dumped into the first job's description. Detect this layout by
// counting how many date-range lines land inside a single blank-line
// chunk: exactly one (or zero) is the normal case — one entry, whose date
// line (if any) supplies the parsed dateRange. Two or more means several
// jobs got merged, so split right after each date-range line instead.
// FIX (bug: "internship tech stack not detected"): resumes commonly list
// tech stack as its own line under a job/internship, e.g. "Tech Stack:
// React, Node.js, MongoDB" or "Technologies used: Python, TensorFlow" —
// this was never looked for at all, so techStack stayed unset and that
// line was left sitting in `bullets` as if it were a regular bullet point.
const TECH_STACK_LINE_REGEX = /^(?:[-•*●▪‣◦·○➤»]\s*)?(?:tech(?:nical)? stack|technologies(?: used)?|tools(?: used)?|stack)\s*[:\-]\s*(.+)$/i;

function extractTechStackFromBullets(bulletLines: string[]): { techStack: string[] | undefined; remaining: string[] } {
  const remaining: string[] = [];
  let techStack: string[] | undefined;
  for (const line of bulletLines) {
    const match = line.trim().match(TECH_STACK_LINE_REGEX);
    if (match && !techStack) {
      techStack = clampList(
        match[1]!.split(/[,•|]/).map((s) => clamp(s.trim(), LIMITS.skillItem)).filter(Boolean),
        LIMITS.skillItemsMax
      );
    } else {
      remaining.push(line);
    }
  }
  return { techStack, remaining };
}

// FIX (bug: "experience location not tracking"): `location` exists on
// ExperienceEntry/EducationEntry but was never populated — a company/role
// line or the date-line remainder often carries it as a trailing
// comma-separated segment, e.g. "Acme Corp, Bengaluru" or "Acme Corp |
// Bengaluru, India | Jun 2025 - Aug 2025". Splitting the raw text on
// commas and treating everything after the first segment as location
// (when present) recovers this without touching unrelated fields.
function splitCompanyAndLocation(raw: string | undefined): { company: string; location?: string } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { company: "" };
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { company: parts[0]!, location: parts.slice(1).join(", ") };
  }
  return { company: trimmed };
}

function parseExperienceBlock(block: string): ExperienceEntry[] {
  if (!block) return [];
  const chunks = mergeBulletContinuationChunks(block.split(/\n{2,}/).filter((c) => c.trim()));
  const entries: ExperienceEntry[] = [];
  let idx = 0;

  const makeEntry = (
    roleLine: string,
    bulletLines: string[],
    dateLine: string | undefined,
    fallbackCompany: string | undefined
  ) => {
    const [rolePart, companyPart, locationFromRoleLine] = roleLine.split(/,|\|| at /i);
    const dateMatch = dateLine ? extractDateRangeFromLine(dateLine) : null;

    // Prefer an explicit 3rd segment on the role line ("Role, Company,
    // City"); otherwise fall back to splitting whatever we do have
    // (company cell, or the leftover text from the date line) on commas.
    const { company, location: locationFromSplit } = splitCompanyAndLocation(
      companyPart ?? dateMatch?.remainder ?? fallbackCompany
    );

    const role = clamp((rolePart ?? roleLine ?? "Role").trim(), LIMITS.companyOrRole);
    const location = (locationFromRoleLine ?? locationFromSplit)?.trim();

    const { techStack, remaining: cleanedBullets } = extractTechStackFromBullets(bulletLines);

    entries.push({
      id: `exp-${idx++}`,
      role,
      company: clamp(company || "Company", LIMITS.companyOrRole),
      location: location ? clamp(location, LIMITS.category) : undefined,
      dateRange: dateMatch
        ? { start: dateMatch.start, end: dateMatch.end, isCurrent: dateMatch.isCurrent }
        : { start: "", end: null, isCurrent: false },
      bullets: clampList(
        cleanedBullets.map((l) => clamp(l.replace(/^[-•*●▪‣◦·○➤»]\s*/, ""), LIMITS.bulletLen)).filter(Boolean),
        LIMITS.experienceBulletsMax
      ),
      isInternship: /intern/i.test(role) || /intern/i.test(company),
      techStack,
    });
  };

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const dateLineIndices = lines
      .map((l, i) => (DATE_RANGE_REGEX.test(l) ? i : -1))
      .filter((i) => i >= 0);

    if (dateLineIndices.length <= 1) {
      // Normal case: one entry per chunk (unchanged from before, except
      // the date range — previously always blank — is now actually
      // parsed when present, whether on the header line or its own line).
      const header = lines[0] ?? "";
      const dateOnOwnLine = dateLineIndices[0] === 1 ? lines[1] : undefined;
      const dateLine = DATE_RANGE_REGEX.test(header) ? header : dateOnOwnLine;
      const bulletsStart = dateOnOwnLine ? 2 : 1;
      makeEntry(header, lines.slice(bulletsStart), dateLine, undefined);
      continue;
    }

    // Merged-entries case: split right after each date-range line. Lines
    // from the previous split point through this date line (inclusive)
    // form one entry — first line is the role/title, the date line
    // supplies company + dates, everything between is bullets.
    let start = 0;
    for (const dateIdx of dateLineIndices) {
      const entryLines = lines.slice(start, dateIdx + 1);
      makeEntry(entryLines[0] ?? "Role", entryLines.slice(1, -1), entryLines[entryLines.length - 1], undefined);
      start = dateIdx + 1;
    }
    // Trailing lines after the last date line (e.g. a current/ongoing role
    // with no closing date yet) still become their own entry rather than
    // being silently dropped.
    if (start < lines.length) {
      const rest = lines.slice(start);
      makeEntry(rest[0] ?? "Role", rest.slice(1), undefined, undefined);
    }
  }

  return entries;
}

// FIX (bug: "education not detected" / dateRange & location always
// blank): this previously used the header line only, never looked at any
// other line in the chunk for dates, and hardcoded dateRange to blank
// unconditionally — even when a date range (e.g. "2021 - 2025") was sitting
// right there on the next line. Now it looks across the whole chunk for a
// date-range line (same helper used by experience/projects) and also
// recovers a location from a 3rd comma-separated segment on the header
// line, e.g. "B.Tech in CS, XYZ University, City".
function parseEducationBlock(block: string): EducationEntry[] {
  if (!block) return [];
  const chunks = mergeBulletContinuationChunks(block.split(/\n{2,}/).filter((c) => c.trim()));
  return chunks.map((chunk, i) => {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const header = lines[0] ?? "";
    const [degreePart, institutionPart, locationPart] = header.split(/,|\|/);

    const dateLineIdx = lines.findIndex((l) => DATE_RANGE_REGEX.test(l));
    const dateLine = dateLineIdx >= 0 ? lines[dateLineIdx] : undefined;
    const dateMatch = dateLine ? extractDateRangeFromLine(dateLine) : null;

    const { location: locationFromRemainder } = splitCompanyAndLocation(
      institutionPart ?? dateMatch?.remainder
    );

    return {
      id: `edu-${i}`,
      degree: clamp((degreePart ?? "Degree").trim(), LIMITS.degreeOrInstitution),
      institution: clamp(
        (institutionPart ? institutionPart.split(",")[0] : dateMatch?.remainder ?? "Institution")!.trim(),
        LIMITS.degreeOrInstitution
      ),
      location: (locationPart ?? locationFromRemainder)
        ? clamp((locationPart ?? locationFromRemainder)!.trim(), LIMITS.category)
        : undefined,
      dateRange: dateMatch
        ? { start: dateMatch.start, end: dateMatch.end, isCurrent: dateMatch.isCurrent }
        : { start: "", end: null, isCurrent: false },
    };
  });
}

// Same merged-entries problem as parseExperienceBlock above, confirmed by
// the same customer for her Projects section too ("sab ek hi heading me
// aa rhe h" — all coming under one heading): a resume that writes
// Title -> bullets -> "Date/Company" line, then straight into the next
// project title with no blank line, gets read as ONE giant project with
// every other project's bullets dumped in. Uses the identical detection —
// count date-range lines inside a blank-line chunk; more than one means
// several projects merged, so split right after each date line.
function parseProjectsBlock(block: string): ProjectEntry[] {
  if (!block) return [];
  const chunks = mergeBulletContinuationChunks(block.split(/\n{2,}/).filter((c) => c.trim()));
  const entries: ProjectEntry[] = [];
  let idx = 0;

  const makeEntry = (titleLine: string, bulletLines: string[], dateLine: string | undefined) => {
    const [namePart] = titleLine.split(/,|\|/);
    const dateMatch = dateLine ? extractDateRangeFromLine(dateLine) : null;
    const links = extractLinks([titleLine, ...bulletLines, dateLine ?? ""].join("\n"));

    const bullets = clampList(
      bulletLines
        .map((l) => l.replace(/^[-•*●▪‣◦·○➤»]\s*/, "").trim())
        .filter((l) => l && !URL_TEST_REGEX.test(l) && !DATE_RANGE_REGEX.test(l))
        .map((l) => clamp(l, LIMITS.bulletLen)),
      LIMITS.projectBulletsMax
    );

    entries.push({
      id: `proj-${idx++}`,
      name: clamp((namePart ?? titleLine ?? "Project").trim(), LIMITS.projectName),
      bullets,
      link: links[0]?.url,
      dateRange: dateMatch
        ? { start: dateMatch.start, end: dateMatch.end, isCurrent: dateMatch.isCurrent }
        : undefined,
    });
  };

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    const dateLineIndices = lines
      .map((l, i) => (DATE_RANGE_REGEX.test(l) ? i : -1))
      .filter((i) => i >= 0);

    if (dateLineIndices.length <= 1) {
      // Normal case: one project per chunk. A date range can appear on
      // the header line itself or on its own line right after it.
      const header = lines[0] ?? "";
      const dateOnOwnLine = dateLineIndices[0] === 1 ? lines[1] : undefined;
      const dateLine = DATE_RANGE_REGEX.test(header) ? header : dateOnOwnLine;
      const bulletsStart = dateOnOwnLine ? 2 : 1;
      makeEntry(header, lines.slice(bulletsStart), dateLine);
      continue;
    }

    // Merged-entries case, same logic as experience: split right after
    // each date-range line.
    let start = 0;
    for (const dateIdx of dateLineIndices) {
      const entryLines = lines.slice(start, dateIdx + 1);
      makeEntry(entryLines[0] ?? "Project", entryLines.slice(1, -1), entryLines[entryLines.length - 1]);
      start = dateIdx + 1;
    }
    if (start < lines.length) {
      const rest = lines.slice(start);
      makeEntry(rest[0] ?? "Project", rest.slice(1), undefined);
    }
  }

  return entries;
}

/**
 * Best-effort conversion of raw extracted text into partial ResumeContent.
 * Always returns a result — never throws — since parsed resumes are messy
 * by nature and downstream code should treat this as a starting draft.
 */
export function parseResumeText(text: string): Partial<ResumeContent> {
  const sections = splitIntoSections(text);
  const contact = extractContact(sections.header || text);

  return {
    contact,
    summary: { summary: sections.summary ? clamp(sections.summary, LIMITS.summary) : undefined },
    experience: parseExperienceBlock(sections.experience || ""),
    education: parseEducationBlock(sections.education || ""),
    skills: parseSkillsBlock(sections.skills || ""),
    projects: parseProjectsBlock(sections.projects || ""),
    certificates: [],
    achievements: [],
  };
}
