import { requireUser } from '@/lib/internships/http/auth';
import { ok, fail } from '@/lib/internships/http/response';
import { getCurrentPlan, getApplicationUnlocksRemaining, getMonthlyApplicationUnlockAllowance } from '@/lib/credits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/internships/unlocks
 *
 * Read-only check of "how many internship application unlocks does this
 * user have left this period" — reuses the exact same entitlement
 * functions the unlock endpoint itself uses to enforce the cap
 * (lib/credits), so this can never drift from what actually gets
 * enforced server-side. Lets the UI show/disable state BEFORE a click,
 * instead of only finding out via a 403 after attempting an unlock.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const [plan, remaining] = await Promise.all([
      getCurrentPlan(user.id),
      getApplicationUnlocksRemaining(user.id),
    ]);

    // Every other route in this API returns { ok, data } via ok() — the
    // client's request() helper unwraps that envelope unconditionally and
    // treats a missing `.data` as a failure. This route used to call
    // NextResponse.json({...}) directly instead, returning the object
    // flat. That's not a cosmetic difference: request() silently read
    // `body.data` as undefined, saw `body.ok` as undefined (falsy), and
    // threw — so useUnlockStatus() never resolved with real data, no
    // matter how many times it was refetched. Every card and the banner
    // read from that same always-undefined value, which is why "Limit
    // reached — Upgrade" never appeared even after the cap was hit
    // server-side and confirmed correct on the wire.
    return ok({
      allowance: plan ? getMonthlyApplicationUnlockAllowance(plan) : null, // null = unlimited
      remaining, // null = unlimited
    });
  } catch (error) {
    return fail(error);
  }
}
