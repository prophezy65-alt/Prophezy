/**
 * SettingsShell.tsx
 * Thin server-safe wrapper expected by app/app/settings/page.tsx.
 *
 * The actual settings UI already lives in SettingsClient, which is fully
 * self-contained (it fetches /api/settings itself via react-query and needs
 * no props). This shell just satisfies the import path the page uses and
 * renders it — no new UI or logic, nothing else changed.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCreditSummary, getApplicationUnlocksRemaining, getCurrentPlan, getMonthlyApplicationUnlockAllowance } from "@/lib/credits";
import SettingsClient from "@/components/dashboard/settings/SettingsClient";

export async function SettingsShell() {
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
