// lib/humanizer/prompts/title-and-format.ts
import { PromptDefinition, withJsonSuffix, isPlainObject } from "./_shared";
import { scanAndNeutralizeInjection } from "@/lib/assignment/validation/security";

// --- Title / headline generation -------------------------------------------------

export interface TitleGenerationResponse {
  titles: { title: string; style: "descriptive" | "seo" | "catchy" | "formal" }[];
}

const TITLE_SCHEMA = `{
  "titles": [{ "title": string, "style": "descriptive"|"seo"|"catchy"|"formal" }]
}`;

const TITLE_SYSTEM_PROMPT = withJsonSuffix(
  `You generate title/headline options for a piece of content.

Produce exactly 4 titles, one of each style:
- descriptive: plainly states what the content is about.
- seo: naturally includes likely search terms a reader would use to find this content.
- catchy: attention-grabbing but not clickbait/misleading — must still accurately
  represent the content.
- formal: suitable for an academic or professional document header.

Every title must accurately represent the actual content provided — never invent a
premise not supported by the source text.`,
  TITLE_SCHEMA
);

function buildTitleUserPrompt(input: Record<string, unknown>): string {
  const rawText = typeof input.text === "string" ? input.text : "";
  const text = scanAndNeutralizeInjection(rawText).cleanedText;
  return `Content:\n\n<<<DOCUMENT_CONTENT_START>>>\n${text}\n<<<DOCUMENT_CONTENT_END>>>`;
}

function validateTitles(parsed: unknown): parsed is TitleGenerationResponse {
  if (!isPlainObject(parsed)) return false;
  if (!Array.isArray(parsed.titles)) return false;
  return parsed.titles.every(
    (t) =>
      isPlainObject(t) &&
      typeof t.title === "string" &&
      ["descriptive", "seo", "catchy", "formal"].includes(t.style as string)
  );
}

export const titleGenerationPrompt: PromptDefinition<TitleGenerationResponse> = {
  id: "humanizer.title.generate",
  systemPrompt: TITLE_SYSTEM_PROMPT,
  buildUserPrompt: buildTitleUserPrompt,
  jsonMode: true,
  responseSchemaDescription: TITLE_SCHEMA,
  temperature: 0.6,
  maxTokens: 1024,
  validate: validateTitles,
};

// --- Bullet <-> paragraph conversion -----------------------------------------------

export interface FormatConversionResponse {
  convertedText: string;
}

const CONVERSION_SCHEMA = `{ "convertedText": string }`;

const CONVERSION_SYSTEM_PROMPT = withJsonSuffix(
  `You convert content between paragraph and bullet-point formats WITHOUT changing its
meaning or adding/removing substantive content.

- "paragraph_to_bullets": break the paragraph(s) into a clean bulleted list, one distinct
  idea per bullet, using "- " as the bullet marker.
- "bullets_to_paragraph": merge a bulleted list into flowing, well-connected prose with
  appropriate transitions — do not just concatenate bullets with periods.`,
  CONVERSION_SCHEMA
);

function buildConversionUserPrompt(input: Record<string, unknown>): string {
  const rawText = typeof input.text === "string" ? input.text : "";
  const text = scanAndNeutralizeInjection(rawText).cleanedText;
  const direction = typeof input.direction === "string" ? input.direction : "paragraph_to_bullets";
  return `Conversion direction: ${direction}\n\n<<<DOCUMENT_CONTENT_START>>>\n${text}\n<<<DOCUMENT_CONTENT_END>>>`;
}

function validateConversion(parsed: unknown): parsed is FormatConversionResponse {
  return isPlainObject(parsed) && typeof parsed.convertedText === "string";
}

export const formatConversionPrompt: PromptDefinition<FormatConversionResponse> = {
  id: "humanizer.format.convert",
  systemPrompt: CONVERSION_SYSTEM_PROMPT,
  buildUserPrompt: buildConversionUserPrompt,
  jsonMode: true,
  responseSchemaDescription: CONVERSION_SCHEMA,
  temperature: 0.2,
  maxTokens: 4096,
  validate: validateConversion,
};
