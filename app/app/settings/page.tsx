import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCreditSummary, getApplicationUnlocksRemaining, getCurrentPlan, getMonthlyApplicationUnlockAllowance } from "@/lib/credits";
import SettingsClient from "@/components/dashboard/settings/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profileRow }, creditSummary, plan, applicationUnlocksRemaining] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    getCreditSummary(user.id),
    getCurrentPlan(user.id),
    getApplicationUnlocksRemaining(user.id),
  ]);

  // Phase 5: Settings must also show the internship unlock allowance/status
  // (previously not fetched here at all). Sourced from the same
  // authoritative plan/credit-transaction data getCreditSummary already
  // uses — not a second system. `allowance`/`remaining` are `null` for a
  // plan with no cap (Premium today) — SettingsClient should render that
  // as "Unlimited", never as 0 or a large placeholder number.
  return (
    <SettingsClient
      profile={{ fullName: profileRow?.full_name ?? "Your account", email: user.email ?? "" }}
      creditSummary={creditSummary}
      applicationUnlocks={{
        allowance: plan ? getMonthlyApplicationUnlockAllowance(plan) : null,
        remaining: applicationUnlocksRemaining,
      }}
    />
  );
}
