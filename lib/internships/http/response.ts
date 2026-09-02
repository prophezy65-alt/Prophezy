import { NextResponse } from 'next/server';
import { EngineError, toEngineError } from '../utils/errors';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.api');

export function ok<T>(data: T, init: { status?: number; cacheSeconds?: number } = {}): NextResponse {
  const response = NextResponse.json({ ok: true, data }, { status: init.status ?? 200 });
  if (init.cacheSeconds) {
    response.headers.set(
      'Cache-Control',
      `private, max-age=0, s-maxage=${init.cacheSeconds}, stale-while-revalidate=${init.cacheSeconds * 2}`,
    );
  }
  return response;
}

export function fail(error: unknown): NextResponse {
  const engineError: EngineError = toEngineError(error);
  if (engineError.status >= 500) {
    log.error('request failed', { code: engineError.code, message: engineError.message, context: engineError.context });
  } else {
    log.warn('request rejected', { code: engineError.code, message: engineError.message });
  }
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: engineError.code,
        message: engineError.status >= 500 ? 'Something went wrong on our side.' : engineError.message,
      },
    },
    { status: engineError.status },
  );
}
