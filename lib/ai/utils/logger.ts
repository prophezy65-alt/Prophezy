/**
 * lib/ai/utils/logger.ts
 *
 * Minimal structured logger for the AI engine. Swap the `sink` implementation
 * for Sentry/Logtail/Axiom/etc later without touching call sites — every
 * log call in lib/ai goes through this module.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  event: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

function sink(entry: LogEntry) {
  const line = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

function log(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  sink({ level, event, meta, timestamp: new Date().toISOString() });
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => log("debug", event, meta),
  info: (event: string, meta?: Record<string, unknown>) => log("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => log("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => log("error", event, meta),
};
