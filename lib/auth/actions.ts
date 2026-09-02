"use server";

import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Server Action version of logout — works from a Server Component with a
 * plain <form action={signOutAction}><button>Log out</button></form>, no
 * client JS needed. Prefer LogoutButton in client components (dropdowns,
 * command palette); use this one in server-rendered menus.
 */
export async function signOutAction() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export interface DevResetPasswordResult {
  success: boolean;
  error?: string;
}

/**
 * DEV-ONLY password reset with no email, no token, no proof of ownership.
 * Exists purely to unblock local testing while SMTP isn't configured yet.
 *
 * SECURITY: this lets anyone who knows a user's email address set a new
 * password for that account, full stop. It is hard-gated behind
 * NODE_ENV so it cannot run in production even if this code ships by
 * accident — but you should still delete this function (and the UI that
 * calls it) once real email delivery (e.g. Resend) is wired up. Don't
 * ship a "forgot password" flow that skips verifying the requester
 * actually owns the email.
 */
export async function devResetPasswordAction(
  email: string,
  newPassword: string,
): Promise<DevResetPasswordResult> {
  if (process.env.NODE_ENV === "production") {
    return { success: false, error: "This flow is disabled in production." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { success: false, error: "Missing Supabase service role configuration." };
  }

  const admin = createAdminClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // The Admin API needs a user id, not an email, and there's no direct
  // "get by email" lookup — so page through users and match.
  let targetId: string | null = null;
  let page = 1;
  const perPage = 1000;

  while (!targetId) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { success: false, error: error.message };

    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      targetId = match.id;
      break;
    }
    if (data.users.length < perPage) break; // no more pages
    page += 1;
  }

  if (!targetId) {
    return { success: false, error: "No account found with that email." };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(targetId, {
    password: newPassword,
  });
  if (updateError) return { success: false, error: updateError.message };

  return { success: true };
}

