import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyApplicationUnlockAllowance } from "@/lib/credits";
import type { Plan } from "@/lib/credits";
import { isPayablePlan } from "@/lib/payments/plans";
import CheckoutButton from "@/components/payments/CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing — Prophezy",
  description: "Prophezy plans: Free, Pro, and Premium — credits, internship application unlocks, and pricing.",
};

export const dynamic = "force-dynamic";

/**
 * Phase 6 — payment integration wired up (Cashfree). Price, monthly
 * credits, and the internship unlock allowance are still read live from
 * public.plans (RLS: plans_select_all, public read) via the SAME
 * lib/credits helpers the rest of the app uses to resolve entitlements —
 * this page does not hardcode any of those numbers.
 *
 * The Free plan CTA stays inert (there is nothing to pay for). Pro and
 * Premium CTAs are the CheckoutButton client component, which only ever
 * sends `planTier` to the server — the server (lib/payments/plans.ts)
 * decides the amount. Whether a plan is currently reachable for checkout
 * is INDEPENDENT of anything hardcoded here: isPayablePlan() is the same
 * guard the API route itself enforces.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  // Set by CheckoutButton's login redirect (?plan=pro / ?plan=premium) so
  // that after a person signs up or logs in and lands back here, the
  // matching plan's checkout resumes automatically at the phone-number
  // step instead of making them find and re-click "Upgrade" again.
  const { plan: resumePlan } = await searchParams;

  // lib/supabase/types.ts (the generated Database type) predates the
  // credit-system tables — same gap noted in
  // lib/credits/credit.repository.ts, worked around the same way here:
  // an untyped SupabaseClient handle for this one query. Re-run
  // `supabase gen types` and this cast can be removed.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from("plans")
    .select("id, name, price_inr, monthly_credits, is_active, features")
    .eq("is_active", true)
    .order("price_inr", { ascending: true });

  const plans: Plan[] = (data ?? []).map((row) => ({
    id: row.id as Plan["id"],
    name: row.name,
    priceInr: Number(row.price_inr),
    monthlyCredits: row.monthly_credits,
    isActive: row.is_active,
    features: (row.features as Record<string, unknown>) ?? {},
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-16">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Pricing
        </div>
        <h1
          className="max-w-3xl text-[clamp(32px,5vw,56px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Plans built around credits and internship unlocks.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
          Every plan includes a monthly credit allowance for AI features and a monthly allowance of internship
          application unlocks. Browsing and searching internships is always free — credits and unlocks are only used
          when you actually generate something or apply.
        </p>
      </div>

      {error || plans.length === 0 ? (
        <p className="text-sm text-white/50">
          Plans are temporarily unavailable. Please refresh, or check back shortly.
        </p>
      ) : (
        <section className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => {
            const unlockAllowance = getMonthlyApplicationUnlockAllowance(plan);
            const buttonClass =
              "w-full rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-white transition hover:bg-white/[0.06]";
            const disabledClass = "w-full rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-white/50";

            return (
              <div key={plan.id} className="flex flex-col rounded-xl border border-white/[0.08] p-6">
                <h2 className="text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                  {plan.name}
                </h2>
                <div className="mt-3 mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {plan.priceInr === 0 ? "₹0" : `₹${plan.priceInr}`}
                  </span>
                  {plan.priceInr > 0 && <span className="text-sm text-white/40">/month</span>}
                </div>
                <ul className="mb-8 flex-1 space-y-3 text-sm text-white/70">
                  <li>{plan.monthlyCredits} credits/month</li>
                  <li>
                    {unlockAllowance === null
                      ? "Unlimited internship application unlocks"
                      : `${unlockAllowance} internship application unlocks/month`}
                  </li>
                </ul>

                {isPayablePlan(plan.id) ? (
                  <CheckoutButton
                    planTier={plan.id}
                    label={`Upgrade to ${plan.name}`}
                    className={buttonClass}
                    disabledClassName={disabledClass}
                    autoStart={resumePlan === plan.id}
                  />
                ) : (
                  <button
                    type="button"
                    disabled
                    className={disabledClass}
                    title="This is your current default plan."
                  >
                    Current default plan
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
