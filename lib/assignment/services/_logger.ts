// lib/assignment/services/_logger.ts
// Minimal structured JSON logger, matching the pattern already established
// by the AI Core Engine's own logger.ts ("Structured JSON logging — swap the
// sink for Sentry/Axiom later"). Kept local to this module so
// lib/assignment/ has zero import-time dependency on the core engine's
// internals beyond the one provider adapter file.

type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    module: "assignment-intelligence-engine",
    ...fields,
  };
  const line = JSON.stringify(entry);

  switch (level) {
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

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write("error", message, fields),
};
