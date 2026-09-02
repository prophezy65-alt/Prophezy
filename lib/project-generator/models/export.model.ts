/**
 * lib/project-generator/models/export.model.ts
 *
 * Describes the final exportable output of a generation: the README
 * content, GitHub template files, and the manifest of every file that
 * gets packaged (markdown / pdf / docx / html / json / zip).
 */

import { ExportFormat, LicenseType } from "./enums";
import { UUID, ISODateString, isNonEmptyString, isUUID } from "./shared.model";

export interface ReadmeSection {
  readonly heading: string;
  readonly level: 1 | 2 | 3 | 4;
  readonly content: string; // Markdown body for this section
}

export interface ReadmeDocument {
  readonly title: string;
  readonly badges: readonly string[]; // Markdown badge snippets, e.g. "![build](...)"
  readonly sections: readonly ReadmeSection[];
  readonly license: LicenseType;
}

export interface GithubTemplateSet {
  readonly contributingMd: string;
  readonly pullRequestTemplateMd: string;
  readonly bugReportIssueTemplateMd: string;
  readonly featureRequestIssueTemplateMd: string;
  readonly codeOwners: string;
}

export interface ExportManifestEntry {
  readonly relativePath: string; // path inside the export bundle
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly mimeType: string;
}

export interface ExportBundle {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly formats: readonly ExportFormat[];
  readonly readme: ReadmeDocument;
  readonly githubTemplates: GithubTemplateSet | null;
  readonly manifest: readonly ExportManifestEntry[];
  readonly storagePath: string; // where the packaged bundle lives (e.g. Supabase Storage key)
  readonly totalSizeBytes: number;
  readonly createdAt: ISODateString;
  readonly expiresAt: ISODateString | null;
}

export function renderReadmeToMarkdown(readme: ReadmeDocument): string {
  const badgeLine = readme.badges.length > 0 ? readme.badges.join(" ") + "\n\n" : "";
  const body = readme.sections
    .map((section) => `${"#".repeat(section.level)} ${section.heading}\n\n${section.content}`)
    .join("\n\n");
  return `# ${readme.title}\n\n${badgeLine}${body}\n\n## License\n\n${readme.license}\n`;
}

export function getManifestEntry(bundle: ExportBundle, relativePath: string): ExportManifestEntry | undefined {
  return bundle.manifest.find((e) => e.relativePath === relativePath);
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function validateExportBundle(bundle: ExportBundle): string[] {
  const problems: string[] = [];

  if (!isUUID(bundle.id)) problems.push("ExportBundle.id must be a UUID.");
  if (!isUUID(bundle.projectSpecId)) problems.push("ExportBundle.projectSpecId must be a UUID.");
  if (bundle.formats.length === 0) problems.push("ExportBundle.formats must contain at least one format.");
  if (!isNonEmptyString(bundle.storagePath)) problems.push("ExportBundle.storagePath is required.");
  if (!isNonEmptyString(bundle.readme.title)) problems.push("ExportBundle.readme.title is required.");
  if (bundle.readme.sections.length === 0) problems.push("ExportBundle.readme.sections must not be empty.");

  const seenPaths = new Set<string>();
  let computedTotal = 0;
  for (const entry of bundle.manifest) {
    if (seenPaths.has(entry.relativePath)) {
      problems.push(`Duplicate manifest entry "${entry.relativePath}".`);
    }
    seenPaths.add(entry.relativePath);
    if (entry.relativePath.startsWith("/") || entry.relativePath.includes("..")) {
      problems.push(`Manifest entry "${entry.relativePath}" must be a safe relative path.`);
    }
    if (!SHA256_PATTERN.test(entry.checksumSha256)) {
      problems.push(`Manifest entry "${entry.relativePath}" has an invalid SHA-256 checksum.`);
    }
    if (entry.sizeBytes < 0) {
      problems.push(`Manifest entry "${entry.relativePath}" has a negative sizeBytes.`);
    }
    computedTotal += entry.sizeBytes;
  }

  if (bundle.manifest.length > 0 && computedTotal !== bundle.totalSizeBytes) {
    problems.push(
      `ExportBundle.totalSizeBytes (${bundle.totalSizeBytes}) does not match sum of manifest entry sizes (${computedTotal}).`
    );
  }

  if (bundle.expiresAt && Date.parse(bundle.expiresAt) <= Date.parse(bundle.createdAt)) {
    problems.push("ExportBundle.expiresAt must be after createdAt.");
  }

  return problems;
}
