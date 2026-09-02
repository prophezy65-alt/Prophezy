/**
 * lib/research/utils/logger.ts
 *
 * Structured JSON logger. No console.log debugging anywhere else in
 * this module — every log line goes through here so the sink can be
 * swapped (e.g. to Axiom/Sentry) in one place, matching lib/ai/utils/logger.ts.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

interface LogEntry extends LogFields {
  level: LogLevel;
  message: string;
  module: 'research';
  timestamp: string;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const entry: LogEntry = {
    level,
    message,
    module: 'research',
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  // eslint-disable-next-line no-console -- this IS the sink
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const researchLogger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
