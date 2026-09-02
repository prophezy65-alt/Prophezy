// lib/assignment/parser/archive-parsers.ts
// ZIP and PPTX both use the OOXML/zip container format under the hood, so
// `jszip` (pure JS, no native binary) handles extraction for both.
//   npm install jszip

import JSZip from "jszip";
import { resolveFileCategory, MAX_ZIP_ENTRIES, assertWithinSizeLimit, UnsupportedFileTypeError } from "./file-router";

export interface ExtractedZipEntry {
  fileName: string;
  category: ReturnType<typeof resolveFileCategory>;
  buffer: Buffer;
}

/**
 * Safely expands a ZIP upload into individual file entries. Guards against
 * zip-bomb style abuse: caps entry count and total decompressed size, and
 * rejects nested archives outright (no recursive unzip) to bound resource
 * usage on the extraction worker.
 */
export async function expandZipArchive(buffer: Buffer): Promise<ExtractedZipEntry[]> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP archive contains ${entries.length} files, exceeding the ${MAX_ZIP_ENTRIES} limit`);
  }

  const results: ExtractedZipEntry[] = [];
  let totalDecompressedBytes = 0;
  const MAX_TOTAL_DECOMPRESSED = 500 * 1024 * 1024; // 500MB aggregate guard

  for (const entry of entries) {
    const lowerName = entry.name.toLowerCase();
    if (lowerName.endsWith(".zip")) {
      // Explicitly reject nested archives rather than silently skipping —
      // the user should know their content wasn't processed.
      throw new Error(`Nested ZIP archives are not supported ("${entry.name}"). Please upload files directly.`);
    }

    const content = await entry.async("nodebuffer");
    totalDecompressedBytes += content.length;
    if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED) {
      throw new Error("ZIP archive exceeds the maximum total decompressed size limit");
    }
    assertWithinSizeLimit(content.length, entry.name);

    try {
      const category = resolveFileCategory(entry.name, "");
      results.push({ fileName: entry.name, category, buffer: content });
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError) {
        // Skip unsupported files inside the archive (e.g. a stray .DS_Store)
        // rather than failing the whole batch.
        continue;
      }
      throw err;
    }
  }

  return results;
}

/**
 * Extracts slide text from a PPTX by reading its OOXML slide XML parts
 * directly. This avoids pulling in a heavy PPTX-specific library for what is
 * fundamentally "read the <a:t> text runs out of ppt/slides/slideN.xml".
 */
export async function extractPptxText(buffer: Buffer): Promise<{ slideNumber: number; text: string }[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
      return numA - numB;
    });

  const results: { slideNumber: number; text: string }[] = [];

  for (const fileName of slideFiles) {
    const xml = await zip.files[fileName]!.async("string");
    const textRuns = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => decodeXmlEntities(m[1]!));
    const slideNumber = parseInt(fileName.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
    results.push({ slideNumber, text: textRuns.join("\n") });
  }

  return results;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
