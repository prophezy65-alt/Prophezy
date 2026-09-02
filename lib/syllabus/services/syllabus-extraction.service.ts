/**
 * lib/syllabus/services/syllabus-extraction.service.ts
 *
 * The entry point for "student uploads a syllabus". Ingests the raw
 * file (PDF/DOCX/image/text, OCR handled transparently by the
 * existing OCR service where needed), then runs it through the
 * extraction prompt via the shared AI engine to produce a fully
 * structured `ExtractedSyllabus`. This is the record every other
 * feature (roadmap, planner, notes, ...) reads from — callers are
 * expected to persist the returned object (storage/persistence is
 * intentionally out of scope here since DB schema is off-limits;
 * wire the return value into your existing Supabase layer).
 */

import { randomUUID } from 'crypto';
import { ingestSyllabus } from '../ingestion/ingestion.service';
import { runSyllabusPrompt } from './_syllabus-ai.runner';
import { syllabusExtractionPrompt } from '../prompts/syllabus-extraction.prompt';
import { validateIngestionInput } from '../validation/syllabus.validation';
import { syllabusLogger } from '../utils/syllabus.logger';
import type {
  ExtractedSyllabus,
  SyllabusIngestionInput,
} from '../models/syllabus.types';

export async function extractSyllabus(
  userId: string,
  rawInput: Partial<SyllabusIngestionInput>,
): Promise<ExtractedSyllabus> {
  const input = validateIngestionInput(rawInput);

  const ingested = await ingestSyllabus(userId, input);
  syllabusLogger.info('syllabus-extraction.ingested', {
    format: ingested.format,
    usedOcr: ingested.usedOcr,
    textLength: ingested.rawText.length,
  });

  const extracted = await runSyllabusPrompt(syllabusExtractionPrompt,
    { rawText: ingested.rawText, sourceFormat: ingested.format },
  { userId });

  const result: ExtractedSyllabus = {
    id: randomUUID(),
    ...extracted,
    extractionWarnings: [...(extracted.extractionWarnings ?? []), ...ingested.warnings],
    extractedAt: new Date().toISOString(),
    sourceFormat: ingested.format,
  };

  syllabusLogger.info('syllabus-extraction.done', {
    syllabusId: result.id,
    unitsCount: result.units.length,
    chaptersCount: result.chapters.length,
  });

  return result;
}
