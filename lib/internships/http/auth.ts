import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getEnv } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

export interface SessionUser {
  id: string;
  email: string | null;
}

export type SessionResolver = () => Promise<SessionUser | null>;

/**
 * Reads the current Supabase session directly, via a plain static import —
 * NOT via an instrumentation.ts-bound indirection. That was tried first and
 * silently didn't work: instrumentation.ts's register() runs in its own
 * webpack compilation, separate from the one each API route is compiled
 * into, so a setSessionResolver() call made from instrumentation.ts mutates
 * a *different in-memory copy* of this module's `resolver` variable than
 * the one requireUser()/optionalUser() read from a route handler — the
 * binding never actually took effect where it mattered, even though the
 * "binding internships session resolver" log line printed fine at boot.
 * A direct import sidesteps that entirely: it's just a normal function
 * call within whichever single compilation the route handler already
 * lives in, no shared mutable singleton across compiler graphs required.
 *
 * Fast path: middleware (lib/supabase/middleware.ts) already calls
 * supabase.auth.getUser() — a network round trip to Supabase's Auth
 * server — for every non-static request, and forwards the verified
 * result via the x-prophezy-user-id / x-prophezy-user-email headers.
 * Those headers can never be spoofed by the client: middleware
 * unconditionally overwrites both on every request, whether or not a
 * user is signed in. Reading them here avoids paying that same network
 * round trip a second time on every internships API call. If the
 * headers are missing — a request that somehow reached this code
 * without going through middleware — fall back to the original direct
 * getUser() call so auth still works correctly, just without the
 * speedup.
 */
async function resolve(): Promise<SessionUser | null> {
  const headerList = await headers();
  const trustedId = headerList.get('x-prophezy-user-id');
  if (trustedId) {
    const trustedEmail = headerList.get('x-prophezy-user-email');
    return { id: trustedId, email: trustedEmail || null };
  }
  if (trustedId === '') {
    // Header present but empty means middleware explicitly resolved "no
    // user" for this request — trust that rather than re-checking.
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await resolve().catch(() => null);
  if (!user) throw new UnauthorizedError('You must be signed in.');
  return user;
}

export async function optionalUser(): Promise<SessionUser | null> {
  return resolve().catch(() => null);
}

/** Auth for machine-triggered routes (GitHub Actions, Supabase scheduled functions). */
export function requireSyncSecret(request: Request): void {
  const expected = getEnv().syncSecret;
  if (!expected) throw new UnauthorizedError('INTERNSHIP_SYNC_SECRET is not configured.');

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!provided) throw new UnauthorizedError('Missing bearer token.');

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new UnauthorizedError('Invalid sync token.');
  }
}
