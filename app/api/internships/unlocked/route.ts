import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/internships/http/auth';
import { ok, fail } from '@/lib/internships/http/response';
import { createClient } from '@/lib/supabase/server';
import { InternshipRepository } from '@/lib/internships/db/repositories/internship.repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/internships/unlocked
 *
 * Every internship this user has ever unlocked (see
 * application-unlock.service.ts / internship_unlocks table), with the
 * real applyUrl attached to each — so a student never loses access to
 * something they already spent an unlock on, even after a reload or on a
 * different device/session. Reads internship_unlocks (RLS-scoped to the
 * caller) for the id/applyUrl pairs, then reuses the EXISTING
 * InternshipRepository.findByIds() (same mapper every other route
 * already uses) for full card data — no new mapping logic.
 */
export async function GET() {
  try {
    const user = await requireUser();
    // lib/supabase/types.ts (the generated Database type) predates the
    // internship_unlocks table — same gap already noted/worked around in
    // lib/credits/credit.repository.ts and the pricing page: an untyped
    // SupabaseClient handle for this one query. Re-run `supabase gen
    // types` and this cast can be removed. No behavior change.
    const supabase = (await createClient()) as unknown as SupabaseClient;

    const { data: unlocks, error } = await supabase
      .from('internship_unlocks')
      .select('internship_id, apply_url, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false });

    if (error) throw error;
    if (!unlocks || unlocks.length === 0) return ok([]);

    const repository = new InternshipRepository();
    const ids = unlocks.map((u) => u.internship_id);
    const records = await repository.findByIds(ids);
    const recordsById = new Map(records.map((r) => [r.id, r]));

    const items = unlocks
      .map((u) => {
        const record = recordsById.get(u.internship_id);
        return record ? { internship: record, applyUrl: u.apply_url } : null;
      })
      .filter((x): x is { internship: (typeof records)[number]; applyUrl: string } => x !== null);

    return ok(items);
  } catch (error) {
    return fail(error);
  }
}
