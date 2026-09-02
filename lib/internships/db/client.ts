import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../config/env';
import { EngineError } from '../utils/errors';

let serviceClient: SupabaseClient | null = null;

/**
 * Service-role client used by sync jobs and server-side reads.
 * NEVER import this into a client component — it bypasses RLS by design.
 * User-scoped routes must use the request-scoped SSR client from `lib/supabase`.
 */
export function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const env = getEnv();
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new EngineError(
      'SUPABASE_UNCONFIGURED',
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
      503,
    );
  }
  serviceClient = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'prophezy-internship-engine' } },
  });
  return serviceClient;
}
