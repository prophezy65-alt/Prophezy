/**
 * lib/credits/admin-plan.service.ts
 *
 * Phase 5 — thin server-side wrapper around the EXISTING
 * public.admin_set_user_plan(p_admin_id, p_user_id, p_plan_tier, p_reason)
 * Postgres function (20260815090000_credit_system_phase4_final_economy.sql).
 * That function is already the one authorized path for a plan change: it
 * independently re-verifies p_admin_id against profiles.role = 'admin'
 * (never trusts the caller's claim), reuses allocate_monthly_credits() for
 * the allowance change (idempotent — resets to the new plan's allowance
 * rather than adding to it, so a retried call never double-allocates),
 * and writes to admin_audit_log. Nothing about that function needed to
 * change for Phase 5; this file exists only so app code (an admin route,
 * a support tool) has a typed, documented entry point instead of calling
 * `.rpc("admin_set_user_plan", ...)` ad hoc in multiple places.
 *
 * NOT a new plan-change mechanism — do not add a second one. If an
 * app-level admin panel already calls admin_set_user_plan directly
 * somewhere else in the codebase, prefer consolidating onto this function
 * rather than keeping both call sites.
 */

import { createClient } from "@/lib/supabase/server";
import type { PlanId } from "./types";

export class NotAuthorizedError extends Error {
  readonly code = "NOT_AUTHORIZED" as const;
  constructor(message = "Only admins can change a user's plan.") {
    super(message);
    this.name = "NotAuthorizedError";
  }
  toJSON() {
    return { error: this.code, message: this.message };
  }
}

export interface SetUserPlanResult {
  userId: string;
  planTier: PlanId;
  status: string;
}

/**
 * Changes `targetUserId`'s plan. MUST be called from a request-scoped
 * client carrying the ACTING ADMIN's own session — this function reads
 * `auth.getUser()` itself and passes that id as p_admin_id, it never
 * accepts an admin id as a parameter. A non-admin caller gets
 * NotAuthorizedError before any RPC is attempted (defense in depth on top
 * of admin_set_user_plan's own server-side profiles.role check — either
 * layer alone is sufficient to block a non-admin, both together mean a
 * bug in one doesn't expose the other).
 */
export async function setUserPlan(
  targetUserId: string,
  planTier: PlanId,
  reason?: string
): Promise<SetUserPlanResult> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) throw new NotAuthorizedError("You must be signed in as an admin.");

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin") throw new NotAuthorizedError();

  const { data, error } = await db.rpc("admin_set_user_plan", {
    p_admin_id: user.id,
    p_user_id: targetUserId,
    p_plan_tier: planTier,
    p_reason: reason ?? undefined,
  });
  if (error) throw error;

  const row = data as { user_id: string; plan_tier: PlanId; status: string };
  return { userId: row.user_id, planTier: row.plan_tier, status: row.status };
}