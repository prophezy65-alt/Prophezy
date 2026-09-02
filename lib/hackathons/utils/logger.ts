/**
 * logger.ts
 * Minimal structured JSON logger.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogFields { [key: string]: unknown }

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const entry = { timestamp: new Date().toISOString(), level, module: "hackathons", message, ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
