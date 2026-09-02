/**
 * lib/syllabus/validation/syllabus.validation.ts
 *
 * Dependency-free validation, matching the pattern in
 * lib/ai/utils/validator.ts. Reuses the EXISTING AIValidationError
 * class from the shared AI engine's error hierarchy rather than
 * defining a parallel one for this module — per the "reuse
 * existing utilities, do not duplicate code" rule.
 *
 * NOTE ON INTEGRATION: this import path/class name is taken from
 * your own lib/ai/README.md ("errors.ts  Shared error classes
 * (AIRequestError, AITimeoutError, AISafetyBlockedError,
 * AIValidationError)"). If the real export name or path differs,
 * this is the only line in the whole Syllabus AI module you need
 * to change — everything else references `AIValidationError` by
 * name only.
 */

import { AIValidationError } from '@/lib/ai/utils/errors';
import type {
  SyllabusIngestionInput,
  SyllabusSourceFormat,
  StudyPlannerInput,
  TopicProgressInput,
} from '../models/syllabus.types';

const VALID_FORMATS: SyllabusSourceFormat[] = ['pdf', 'docx', 'image', 'text'];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB

export function validateIngestionInput(
  input: Partial<SyllabusIngestionInput>,
): SyllabusIngestionInput {
  const issues: string[] = [];

  if (!input.format || !VALID_FORMATS.includes(input.format)) {
    issues.push(`format must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  if (input.content === undefined || input.content === null) {
    issues.push('content is required');
  } else if (input.format === 'text' && typeof input.content !== 'string') {
    issues.push('content must be a string when format is "text"');
  } else if (input.format !== 'text' && !Buffer.isBuffer(input.content)) {
    issues.push('content must be a Buffer for pdf/docx/image formats');
  } else if (Buffer.isBuffer(input.content) && input.content.length > MAX_FILE_BYTES) {
    issues.push(`file exceeds maximum size of ${MAX_FILE_BYTES / (1024 * 1024)}MB`);
  } else if (typeof input.content === 'string' && input.content.trim().length === 0) {
    issues.push('content must not be empty');
  }

  if (issues.length > 0) {
    throw new AIValidationError('Invalid syllabus ingestion input', issues);
  }

  return {
    format: input.format as SyllabusSourceFormat,
    content: input.content as Buffer | string,
    fileName: input.fileName,
    mimeType: input.mimeType,
  };
}

export function validateStudyPlannerInput(
  input: Partial<StudyPlannerInput>,
): StudyPlannerInput {
  const issues: string[] = [];

  if (!input.syllabusId || typeof input.syllabusId !== 'string') {
    issues.push('syllabusId is required');
  }
  if (!input.examDate || Number.isNaN(Date.parse(input.examDate))) {
    issues.push('examDate must be a valid ISO date string');
  } else if (Date.parse(input.examDate) < Date.now() - 24 * 60 * 60 * 1000) {
    issues.push('examDate must not be in the past');
  }
  if (
    input.hoursAvailablePerDay === undefined ||
    typeof input.hoursAvailablePerDay !== 'number' ||
    input.hoursAvailablePerDay <= 0 ||
    input.hoursAvailablePerDay > 24
  ) {
    issues.push('hoursAvailablePerDay must be a number between 0 and 24');
  }

  if (issues.length > 0) {
    throw new AIValidationError('Invalid study planner input', issues);
  }

  return {
    syllabusId: input.syllabusId!,
    examDate: input.examDate!,
    hoursAvailablePerDay: input.hoursAvailablePerDay!,
    completedTopics: input.completedTopics ?? [],
    weakTopics: input.weakTopics ?? [],
    strongTopics: input.strongTopics ?? [],
    missedDays: input.missedDays ?? [],
  };
}

export function validateTopicProgressInputs(
  inputs: Partial<TopicProgressInput>[],
): TopicProgressInput[] {
  const issues: string[] = [];

  inputs.forEach((input, index) => {
    if (!input.topic || typeof input.topic !== 'string') {
      issues.push(`entry[${index}].topic is required`);
    }
    if (typeof input.completed !== 'boolean') {
      issues.push(`entry[${index}].completed must be a boolean`);
    }
    if (input.revisedCount === undefined || input.revisedCount < 0) {
      issues.push(`entry[${index}].revisedCount must be a non-negative number`);
    }
    if (
      input.selfRatedConfidence !== undefined &&
      (input.selfRatedConfidence < 0 || input.selfRatedConfidence > 100)
    ) {
      issues.push(`entry[${index}].selfRatedConfidence must be between 0 and 100`);
    }
    if (
      input.quizAccuracyPercent !== undefined &&
      (input.quizAccuracyPercent < 0 || input.quizAccuracyPercent > 100)
    ) {
      issues.push(`entry[${index}].quizAccuracyPercent must be between 0 and 100`);
    }
  });

  if (issues.length > 0) {
    throw new AIValidationError('Invalid topic progress input', issues);
  }

  return inputs.map((input) => ({
    topic: input.topic!,
    completed: input.completed!,
    revisedCount: input.revisedCount!,
    selfRatedConfidence: input.selfRatedConfidence,
    quizAccuracyPercent: input.quizAccuracyPercent,
  }));
}
