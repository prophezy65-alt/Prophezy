type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const MIN_LEVEL: Level =
  (process.env.INTERNSHIP_LOG_LEVEL as Level | undefined) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/** Keys whose values are redacted before a log line is emitted. */
const SECRET_KEYS = /key|token|secret|password|authorization|cookie/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function emit(level: Level, scope: string, bindings: Record<string, unknown>, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(redact(bindings) as Record<string, unknown>),
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string, bindings: Record<string, unknown> = {}): Logger {
  return {
    debug: (m, meta) => emit('debug', scope, bindings, m, meta),
    info: (m, meta) => emit('info', scope, bindings, m, meta),
    warn: (m, meta) => emit('warn', scope, bindings, m, meta),
    error: (m, meta) => emit('error', scope, bindings, m, meta),
    child: (extra) => createLogger(scope, { ...bindings, ...extra }),
  };
}

export const logger = createLogger('internships');
