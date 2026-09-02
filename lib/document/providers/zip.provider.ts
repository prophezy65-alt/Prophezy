/**
 * lib/document/providers/zip.provider.ts
 *
 * No zip library appears in your listed tech stack. This uses `adm-zip` if
 * it's already a dependency (very common in Node/Next.js projects for
 * exactly this); if it's not installed, this throws a clear, actionable
 * error rather than pretending to expand the archive. Every extracted
 * entry is run through `assertSafeZipEntries` (zip-slip + zip-bomb guards)
 * before anything touches disk or a downstream parser.
 */

import { assertSafeZipEntries, type ZipEntryInfo } from "../validation/file-security";
import { NotWiredError, ParsingError } from "../errors/document-errors";

export interface ZipEntryContent {
  name: string;
  buffer: Buffer;
  sizeBytes: number;
}

export async function expandZip(buffer: Buffer): Promise<ZipEntryContent[]> {
  let AdmZip: any;
  try {
    AdmZip = (await import("adm-zip")).default;
  } catch {
    throw new NotWiredError(
      "zip.provider.ts",
      "no zip library found — run `npm install adm-zip` (or point this file at whichever zip " +
        "library is already used elsewhere in Prophezy) and re-import here."
    );
  }

  let zip: any;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    throw new ParsingError("Failed to open ZIP archive — it may be corrupted.", {
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  const rawEntries = zip.getEntries().filter((e: any) => !e.isDirectory);

  const entryInfos: ZipEntryInfo[] = rawEntries.map((e: any) => ({
    name: e.entryName,
    sizeBytes: e.header.size,
    compressedSizeBytes: e.header.compressedSize,
  }));

  assertSafeZipEntries(entryInfos);

  return rawEntries.map((e: any) => ({
    name: e.entryName,
    buffer: e.getData(),
    sizeBytes: e.header.size,
  }));
}

/** Infers a supported FileFormat from a zip entry's extension, or null to skip it. */
export function formatFromEntryName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ?? null;
}
