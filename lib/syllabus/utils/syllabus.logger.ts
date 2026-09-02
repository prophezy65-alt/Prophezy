/**
 * lib/syllabus/utils/syllabus.logger.ts
 *
 * Scoped structured logger for steps unique to this module
 * (ingestion, deterministic planning/progress math). Every AI-call
 * service logs through the EXISTING engine logging instead — this
 * one is only for the new non-AI plumbing so log lines are easy to
 * filter by `module: "syllabus"` without duplicating the AI engine's
 * logger.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const entry = {
    level,
    message,
    module: 'syllabus',
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  // eslint-disable-next-line no-console -- this IS the sink
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const syllabusLogger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
