// lib/humanizer/services/_logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const entry = { level, message, timestamp: new Date().toISOString(), module: "humanizer-engine", ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),
};
