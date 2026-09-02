/**
 * lib/document/errors/document-errors.ts
 * Mirrors the shape of lib/ai/utils/errors.ts (AIValidationError etc.) so
 * error handling stays consistent across the codebase — named/typed classes,
 * not generic thrown strings.
 */

export class DocumentError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DocumentError";
    this.code = code;
    this.details = details;
  }
}

export class UnsupportedFormatError extends DocumentError {
  constructor(format: string, details?: Record<string, unknown>) {
    super(`Unsupported file format: ${format}`, "UNSUPPORTED_FORMAT", details);
    this.name = "UnsupportedFormatError";
  }
}

export class FutureFormatError extends DocumentError {
  constructor(format: string) {
    super(
      `"${format}" is a future-ready format placeholder — no provider is wired up yet.`,
      "FUTURE_FORMAT_NOT_WIRED",
      { format }
    );
    this.name = "FutureFormatError";
  }
}

export class FileValidationError extends DocumentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "FILE_VALIDATION_ERROR", details);
    this.name = "FileValidationError";
  }
}

export class MaliciousFileError extends DocumentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "MALICIOUS_FILE_DETECTED", details);
    this.name = "MaliciousFileError";
  }
}

export class ParsingError extends DocumentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "PARSING_ERROR", details);
    this.name = "ParsingError";
  }
}

export class OcrError extends DocumentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "OCR_ERROR", details);
    this.name = "OcrError";
  }
}

export class ChunkingError extends DocumentError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CHUNKING_ERROR", details);
    this.name = "ChunkingError";
  }
}

export class NotWiredError extends DocumentError {
  constructor(fileHint: string, whatToWire: string) {
    super(
      `${fileHint}: this depends on an integration I don't have source for — ${whatToWire}`,
      "NOT_WIRED",
      { fileHint }
    );
    this.name = "NotWiredError";
  }
}
